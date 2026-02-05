import mongoose, { Types, FilterQuery, ClientSession } from 'mongoose';
import { PaymentRequest, IPaymentRequestDocument, PaymentRequestStatus } from './payment-request.model.js';
import { PaymentSubmission, IPaymentSubmissionDocument } from './payment-submission.model.js';
import { User, IUserDocument } from '../users/user.model.js';
import { Transaction } from '../wallet/transaction.model.js';
import { logger } from '../../config/logger.js';
import {
  CreatePaymentRequestInput,
  UpdatePaymentRequestInput,
  PaymentRequestFilters,
  StudentPaymentFilters,
  HistoryFilters,
} from './adhoc-payments.validation.js';

// Custom error class
export class AdhocPaymentsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AdhocPaymentsError';
  }
}

// Response types
export interface PaginatedPaymentRequests {
  requests: IPaymentRequestDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface StudentPaymentStatus {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  year: number;
  status: 'pending' | 'paid';
  paidAt?: Date;
  amount: number;
}

export interface PaginatedStudentPayments {
  students: StudentPaymentStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface PendingPayment {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate?: Date;
  status: 'pending' | 'paid';
  requestCreatedAt: Date;
}

export interface PaymentResult {
  transaction: {
    id: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
  };
  newBalance: number;
}

export interface PaginatedPaymentHistory {
  payments: Array<{
    id: string;
    title: string;
    description: string;
    amount: number;
    status: string;
    paidAt?: Date;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Ad-hoc Payments Service
 */
export class AdhocPaymentsService {
  // ==================== SUPERADMIN METHODS ====================

  /**
   * Create a new payment request
   */
  async createPaymentRequest(data: CreatePaymentRequestInput, adminId: string): Promise<IPaymentRequestDocument> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Calculate total target count and get target student IDs
      let targetStudentIds: Types.ObjectId[] = [];
      let totalTargetCount = 0;

      if (data.targetType === 'all') {
        // Get all active, approved students
        const students = await User.find({
          role: 'student',
          isActive: true,
          isApproved: true,
        }).session(session);
        targetStudentIds = students.map((s) => s._id);
        totalTargetCount = students.length;
      } else if (data.targetType === 'selected') {
        // Validate provided student IDs
        const studentIds = data.targetStudents!.map((id) => new Types.ObjectId(id));
        const validStudents = await User.find({
          _id: { $in: studentIds },
          role: 'student',
          isActive: true,
          isApproved: true,
        }).session(session);

        if (validStudents.length !== studentIds.length) {
          throw new AdhocPaymentsError(
            'Some student IDs are invalid or students are not active/approved',
            'INVALID_STUDENTS',
            400
          );
        }

        targetStudentIds = validStudents.map((s) => s._id);
        totalTargetCount = validStudents.length;
      } else if (data.targetType === 'department') {
        // Get students by department
        const students = await User.find({
          role: 'student',
          isActive: true,
          isApproved: true,
          department: data.targetDepartment,
        }).session(session);
        targetStudentIds = students.map((s) => s._id);
        totalTargetCount = students.length;
      } else if (data.targetType === 'year') {
        // Get students by year
        const students = await User.find({
          role: 'student',
          isActive: true,
          isApproved: true,
          year: data.targetYear,
        }).session(session);
        targetStudentIds = students.map((s) => s._id);
        totalTargetCount = students.length;
      }

      if (totalTargetCount === 0) {
        throw new AdhocPaymentsError('No eligible students found for the specified criteria', 'NO_TARGET_STUDENTS', 400);
      }

      // Create payment request
      const paymentRequest = new PaymentRequest({
        title: data.title,
        description: data.description,
        amount: data.amount,
        targetType: data.targetType,
        targetStudents: data.targetType === 'selected' ? targetStudentIds : [],
        targetDepartment: data.targetDepartment,
        targetYear: data.targetYear,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        isVisibleOnDashboard: data.isVisibleOnDashboard ?? true,
        createdBy: new Types.ObjectId(adminId),
        totalTargetCount,
        paidCount: 0,
        totalCollected: 0,
      });

      await paymentRequest.save({ session });

      // Create payment submissions for all target students
      const submissions = targetStudentIds.map((studentId) => ({
        paymentRequest: paymentRequest._id,
        student: studentId,
        status: 'pending' as const,
        amount: data.amount,
      }));

      await PaymentSubmission.insertMany(submissions, { session });

      await session.commitTransaction();

      logger.info('Payment request created', {
        requestId: paymentRequest._id,
        adminId,
        targetType: data.targetType,
        totalTargetCount,
        amount: data.amount,
      });

      return paymentRequest;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all payment requests with pagination
   */
  async getPaymentRequests(filters: PaymentRequestFilters): Promise<PaginatedPaymentRequests> {
    const { status, page = 1, limit = 20 } = filters;

    const query: FilterQuery<IPaymentRequestDocument> = {};
    if (status) {
      query.status = status;
    }

    const total = await PaymentRequest.countDocuments(query);
    const skip = (page - 1) * limit;

    const requests = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email');

    const totalPages = Math.ceil(total / limit);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single payment request by ID
   */
  async getPaymentRequestById(requestId: string): Promise<IPaymentRequestDocument> {
    const request = await PaymentRequest.findById(requestId).populate('createdBy', 'name email');

    if (!request) {
      throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
    }

    return request;
  }

  /**
   * Update payment request
   */
  async updatePaymentRequest(requestId: string, data: UpdatePaymentRequestInput): Promise<IPaymentRequestDocument> {
    const request = await PaymentRequest.findById(requestId);

    if (!request) {
      throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
    }

    // Check if any payments have been made
    if (request.paidCount > 0) {
      // Only allow visibility and due date changes if payments exist
      if (data.title || data.description) {
        throw new AdhocPaymentsError(
          'Cannot modify title or description after payments have been received',
          'PAYMENTS_EXIST',
          400
        );
      }
    }

    // Update allowed fields
    if (data.title !== undefined) request.title = data.title;
    if (data.description !== undefined) request.description = data.description;
    if (data.isVisibleOnDashboard !== undefined) request.isVisibleOnDashboard = data.isVisibleOnDashboard;
    if (data.dueDate !== undefined) {
      request.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
    }

    await request.save();

    logger.info('Payment request updated', { requestId, changes: data });

    return request;
  }

  /**
   * Close or cancel a payment request
   */
  async closePaymentRequest(
    requestId: string,
    status: 'closed' | 'cancelled'
  ): Promise<IPaymentRequestDocument> {
    const request = await PaymentRequest.findById(requestId);

    if (!request) {
      throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
    }

    if (request.status !== 'active') {
      throw new AdhocPaymentsError('Payment request is not active', 'ALREADY_CLOSED', 400);
    }

    request.status = status;
    await request.save();

    logger.info('Payment request closed', { requestId, status });

    return request;
  }

  /**
   * Get students for a payment request with their payment status
   */
  async getStudentsForRequest(requestId: string, filters: StudentPaymentFilters): Promise<PaginatedStudentPayments> {
    const { status, search, page = 1, limit = 20 } = filters;

    const request = await PaymentRequest.findById(requestId);
    if (!request) {
      throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
    }

    // Build match conditions for aggregation
    const matchConditions: Record<string, unknown>[] = [{ paymentRequest: new Types.ObjectId(requestId) }];

    if (status && status !== 'all') {
      matchConditions.push({ status: status });
    }

    // Build user match for search
    const userMatch: Record<string, unknown> = {};
    if (search) {
      userMatch.$or = [
        { 'studentInfo.name': { $regex: search, $options: 'i' } },
        { 'studentInfo.email': { $regex: search, $options: 'i' } },
        { 'studentInfo.rollNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const aggregation = PaymentSubmission.aggregate([
      { $match: { $and: matchConditions } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      { $unwind: '$studentInfo' },
      ...(search ? [{ $match: userMatch }] : []),
      {
        $facet: {
          data: [
            { $sort: { 'studentInfo.name': 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                id: '$student',
                name: '$studentInfo.name',
                email: '$studentInfo.email',
                rollNumber: '$studentInfo.rollNumber',
                department: '$studentInfo.department',
                year: '$studentInfo.year',
                status: 1,
                paidAt: 1,
                amount: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const [result] = await aggregation;

    const students: StudentPaymentStatus[] = result.data.map((s: Record<string, unknown>) => ({
      id: (s.id as Types.ObjectId).toString(),
      name: s.name as string,
      email: s.email as string,
      rollNumber: s.rollNumber as string,
      department: s.department as string,
      year: s.year as number,
      status: s.status as 'pending' | 'paid',
      paidAt: s.paidAt as Date | undefined,
      amount: s.amount as number,
    }));

    const total = result.total[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get unpaid students for reminder notifications
   */
  async getUnpaidStudents(requestId: string): Promise<IUserDocument[]> {
    const unpaidSubmissions = await PaymentSubmission.find({
      paymentRequest: new Types.ObjectId(requestId),
      status: { $ne: 'paid' },
    }).select('student');

    const studentIds = unpaidSubmissions.map((s) => s.student);

    return User.find({
      _id: { $in: studentIds },
      isActive: true,
    }).select('name email fcmTokens');
  }

  /**
   * Send payment reminders to unpaid students
   * Returns count of students notified
   */
  async sendPaymentReminders(requestId: string, adminId: string): Promise<number> {
    const request = await PaymentRequest.findById(requestId);
    if (!request) {
      throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
    }

    if (request.status !== 'active') {
      throw new AdhocPaymentsError('Cannot send reminders for inactive payment request', 'REQUEST_INACTIVE', 400);
    }

    const unpaidStudents = await this.getUnpaidStudents(requestId);

    // TODO: Integrate with notification service for FCM push
    // For now, just log and return count

    logger.info('Payment reminders sent', {
      requestId,
      adminId,
      studentCount: unpaidStudents.length,
    });

    return unpaidStudents.length;
  }

  // ==================== STUDENT METHODS ====================

  /**
   * Get pending payments for a student
   */
  async getPendingPaymentsForStudent(studentId: string): Promise<PendingPayment[]> {
    // Get student info for targeting
    const student = await User.findById(studentId);
    if (!student) {
      throw new AdhocPaymentsError('Student not found', 'STUDENT_NOT_FOUND', 404);
    }

    // Find pending submissions for this student
    const submissions = await PaymentSubmission.find({
      student: new Types.ObjectId(studentId),
      status: 'pending',
    }).populate({
      path: 'paymentRequest',
      match: { status: 'active', isVisibleOnDashboard: true },
    });

    // Filter out submissions where paymentRequest was filtered out by match
    const validSubmissions = submissions.filter((s) => s.paymentRequest !== null);

    return validSubmissions.map((s) => {
      const request = s.paymentRequest as unknown as IPaymentRequestDocument;
      return {
        id: request._id.toString(),
        title: request.title,
        description: request.description,
        amount: s.amount,
        dueDate: request.dueDate,
        status: 'pending' as const,
        requestCreatedAt: request.createdAt,
      };
    });
  }

  /**
   * Pay a payment request (debit from wallet)
   */
  async payRequest(studentId: string, requestId: string): Promise<PaymentResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify request exists and is active
      const request = await PaymentRequest.findById(requestId).session(session);
      if (!request) {
        throw new AdhocPaymentsError('Payment request not found', 'REQUEST_NOT_FOUND', 404);
      }

      if (request.status !== 'active') {
        throw new AdhocPaymentsError('Payment request is no longer active', 'REQUEST_INACTIVE', 400);
      }

      // Get submission
      const submission = await PaymentSubmission.findOne({
        paymentRequest: new Types.ObjectId(requestId),
        student: new Types.ObjectId(studentId),
      }).session(session);

      if (!submission) {
        throw new AdhocPaymentsError('You are not eligible for this payment request', 'NOT_ELIGIBLE', 403);
      }

      if (submission.status === 'paid') {
        throw new AdhocPaymentsError('You have already paid this request', 'ALREADY_PAID', 400);
      }

      // Get student and check balance
      const student = await User.findById(studentId).session(session);
      if (!student) {
        throw new AdhocPaymentsError('Student not found', 'STUDENT_NOT_FOUND', 404);
      }

      if (!student.isActive) {
        throw new AdhocPaymentsError('Student account is deactivated', 'STUDENT_INACTIVE', 403);
      }

      const amount = submission.amount;
      if (student.balance < amount) {
        throw new AdhocPaymentsError(
          `Insufficient balance. Current: Rs.${student.balance}, Required: Rs.${amount}`,
          'INSUFFICIENT_BALANCE',
          400
        );
      }

      // Debit wallet
      const balanceBefore = student.balance;
      const balanceAfter = balanceBefore - amount;

      student.balance = balanceAfter;
      await student.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        user: student._id,
        type: 'debit',
        amount,
        balanceBefore,
        balanceAfter,
        source: 'adhoc_payment',
        description: `Payment for: ${request.title}`,
        status: 'completed',
        metadata: {
          paymentRequestId: request._id.toString(),
          paymentRequestTitle: request.title,
        },
      });

      await transaction.save({ session });

      // Update submission
      submission.status = 'paid';
      submission.paidAt = new Date();
      submission.transaction = transaction._id;
      await submission.save({ session });

      // Update request stats
      request.paidCount += 1;
      request.totalCollected += amount;
      await request.save({ session });

      await session.commitTransaction();

      logger.info('Adhoc payment completed', {
        studentId,
        requestId,
        amount,
        newBalance: balanceAfter,
        transactionId: transaction._id,
      });

      return {
        transaction: {
          id: transaction._id.toString(),
          amount: transaction.amount,
          balanceBefore: transaction.balanceBefore,
          balanceAfter: transaction.balanceAfter,
        },
        newBalance: balanceAfter,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get student's payment history
   */
  async getStudentPaymentHistory(studentId: string, filters: HistoryFilters): Promise<PaginatedPaymentHistory> {
    const { status, page = 1, limit = 20 } = filters;

    const query: FilterQuery<IPaymentSubmissionDocument> = {
      student: new Types.ObjectId(studentId),
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await PaymentSubmission.countDocuments(query);
    const skip = (page - 1) * limit;

    const submissions = await PaymentSubmission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('paymentRequest', 'title description');

    const payments = submissions.map((s) => {
      const request = s.paymentRequest as unknown as IPaymentRequestDocument;
      return {
        id: s._id.toString(),
        title: request?.title || 'Unknown',
        description: request?.description || '',
        amount: s.amount,
        status: s.status,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

// Export singleton instance
export const adhocPaymentsService = new AdhocPaymentsService();
