import { Request, Response, NextFunction } from 'express';
import { adhocPaymentsService, AdhocPaymentsError } from './adhoc-payments.service.js';
import {
  createPaymentRequestSchema,
  updatePaymentRequestSchema,
  closePaymentRequestSchema,
  studentPaymentFiltersSchema,
  historyFiltersSchema,
  requestIdParamSchema,
} from './adhoc-payments.validation.js';
import type { PaymentRequestFilters } from './adhoc-payments.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

/**
 * Ad-hoc Payments Controller - Handles HTTP requests for payment operations
 */
export class AdhocPaymentsController {
  // ==================== SUPERADMIN ENDPOINTS ====================

  /**
   * Create a new payment request
   * POST /superadmin/payments
   */
  async createPaymentRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = createPaymentRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const result = await adhocPaymentsService.createPaymentRequest(validationResult.data, adminId);

      logger.info('Payment request created', {
        requestId: result._id,
        adminId,
        title: result.title,
        targetType: result.targetType,
        totalTargetCount: result.totalTargetCount,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
        message: 'Payment request created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all payment requests with filters
   * GET /superadmin/payments
   */
  async getPaymentRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Query is already validated and transformed by validateQuery middleware
      const filters = req.query as unknown as PaymentRequestFilters;

      const result = await adhocPaymentsService.getPaymentRequests(filters);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.requests,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single payment request by ID
   * GET /superadmin/payments/:id
   */
  async getPaymentRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      const result = await adhocPaymentsService.getPaymentRequestById(paramValidation.data.id);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Update payment request
   * PUT /superadmin/payments/:id
   */
  async updatePaymentRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      // Validate request body
      const bodyValidation = updatePaymentRequestSchema.safeParse(req.body);

      if (!bodyValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: bodyValidation.error.errors,
          },
        });
        return;
      }

      const result = await adhocPaymentsService.updatePaymentRequest(
        paramValidation.data.id,
        bodyValidation.data
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        message: 'Payment request updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Close or cancel a payment request
   * POST /superadmin/payments/:id/close
   */
  async closePaymentRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      // Validate request body
      const bodyValidation = closePaymentRequestSchema.safeParse(req.body);

      if (!bodyValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: bodyValidation.error.errors,
          },
        });
        return;
      }

      const result = await adhocPaymentsService.closePaymentRequest(
        paramValidation.data.id,
        bodyValidation.data.status
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        message: `Payment request ${bodyValidation.data.status} successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get students for a payment request with their payment status
   * GET /superadmin/payments/:id/students
   */
  async getStudentsForRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      // Validate query parameters
      const queryValidation = studentPaymentFiltersSchema.safeParse(req.query);

      if (!queryValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryValidation.error.errors,
          },
        });
        return;
      }

      const result = await adhocPaymentsService.getStudentsForRequest(
        paramValidation.data.id,
        queryValidation.data
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.students,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Send payment reminders to unpaid students
   * POST /superadmin/payments/:id/remind
   */
  async sendReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      const count = await adhocPaymentsService.sendPaymentReminders(paramValidation.data.id, adminId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: { count },
        message: `Reminders sent to ${count} students`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  // ==================== STUDENT ENDPOINTS ====================

  /**
   * Get pending payments for logged-in student
   * GET /student/payments/pending
   */
  async getPendingPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user?.id;

      if (!studentId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const result = await adhocPaymentsService.getPendingPaymentsForStudent(studentId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Pay a pending payment request
   * POST /student/payments/:id/pay
   */
  async payRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user?.id;

      if (!studentId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      // Validate request ID
      const paramValidation = requestIdParamSchema.safeParse(req.params);

      if (!paramValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid request ID format',
          },
        });
        return;
      }

      const result = await adhocPaymentsService.payRequest(studentId, paramValidation.data.id);

      logger.info('Student paid adhoc payment', {
        studentId,
        requestId: paramValidation.data.id,
        amount: result.transaction.amount,
        newBalance: result.newBalance,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        message: 'Payment successful',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get payment history for student
   * GET /student/payments/history
   */
  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user?.id;

      if (!studentId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      // Validate query parameters
      const queryValidation = historyFiltersSchema.safeParse(req.query);

      if (!queryValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryValidation.error.errors,
          },
        });
        return;
      }

      const result = await adhocPaymentsService.getStudentPaymentHistory(studentId, queryValidation.data);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AdhocPaymentsError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
}

// Export singleton instance
export const adhocPaymentsController = new AdhocPaymentsController();
