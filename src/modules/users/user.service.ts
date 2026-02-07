import mongoose, { Types, FilterQuery } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, IUserDocument, UserRole } from './user.model.js';
import { getCurrentTransactionModel } from '../wallet/monthly-transaction.util.js';
import { Order } from '../orders/order.model.js';
import { logger } from '../../config/logger.js';
import { convertToProxyUrl } from '../../shared/utils/image-url.util.js';

const SALT_ROUNDS = 12;

// Custom error class for user operations
export class UserError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserError';
  }
}

// Types for service parameters
export interface SearchUsersParams {
  search?: string | undefined;
  role?: UserRole | undefined;
  department?: string | undefined;
  year?: number | undefined;
  isApproved?: boolean | undefined;
  isActive?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface UpdateProfileData {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  avatarUrl?: string | undefined;
  dietPreference?: 'all' | 'veg' | 'nonveg' | undefined;
}

export interface PaginatedUsers {
  users: IUserDocument[];
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
 * User Service - Handles all user-related operations
 */
export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<IUserDocument> {
    const user = await User.findById(id);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    return user;
  }

  /**
   * Get user by username (for login)
   */
  async getUserByUsername(username: string): Promise<IUserDocument | null> {
    return User.findOne({ username: username.toLowerCase() }).select('+passwordHash');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Check if email is being changed and if it's unique
    if (data.email && data.email !== user.email) {
      const existingUser = await User.findOne({ email: data.email.toLowerCase() });
      if (existingUser) {
        throw new UserError('Email is already in use', 'EMAIL_IN_USE', 409);
      }
    }

    // Update allowed fields
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.dietPreference !== undefined) user.dietPreference = data.dietPreference;

    await user.save();

    logger.info('User profile updated', { userId, updatedFields: Object.keys(data) });

    return user;
  }

  /**
   * Get pending approvals (students where isApproved=false)
   */
  async getPendingApprovals(): Promise<IUserDocument[]> {
    return User.find({
      role: 'student',
      isApproved: false,
      isActive: true,
    }).sort({ createdAt: 1 });
  }

  /**
   * Approve a user
   */
  async approveUser(userId: string, initialBalance: number = 0): Promise<IUserDocument> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new UserError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (user.isApproved) {
        throw new UserError('User is already approved', 'ALREADY_APPROVED', 400);
      }

      // Approve user
      user.isApproved = true;

      // Add initial balance if specified
      if (initialBalance > 0) {
        user.balance = initialBalance;

        // Create initial credit transaction in monthly collection
        const TransactionModel = getCurrentTransactionModel();
        await TransactionModel.create(
          [
            {
              user: user._id,
              type: 'credit',
              amount: initialBalance,
              balanceBefore: 0,
              balanceAfter: initialBalance,
              source: 'adjustment',
              description: 'Initial wallet balance on account approval',
              status: 'completed',
            },
          ],
          { session }
        );
      }

      await user.save({ session });

      await session.commitTransaction();

      logger.info('User approved', { userId, initialBalance });

      return user;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reject a user (delete or mark as rejected)
   */
  async rejectUser(userId: string): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.isApproved) {
      throw new UserError('Cannot reject an already approved user', 'ALREADY_APPROVED', 400);
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    logger.info('User rejected and deleted', { userId });
  }

  /**
   * Get all students with search and pagination
   */
  async getAllStudents(params: SearchUsersParams): Promise<PaginatedUsers> {
    const { search, department, year, isApproved = true, isActive = true, page = 1, limit = 20 } = params;

    // Build query
    const query: FilterQuery<IUserDocument> = {
      role: 'student',
      isApproved,
      isActive,
    };

    if (department) {
      query.department = department;
    }

    if (year) {
      query.year = year;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { rollNumber: searchRegex },
        { username: searchRegex },
      ];
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users with pagination
    const skip = (page - 1) * limit;
    const users = await User.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
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
   * Get all users (for superadmin)
   */
  async getAllUsers(params: SearchUsersParams): Promise<PaginatedUsers> {
    const { search, role, department, year, isApproved, isActive, page = 1, limit = 20 } = params;

    // Build query
    const query: FilterQuery<IUserDocument> = {};

    if (role) {
      query.role = role;
    }

    if (department) {
      query.department = department;
    }

    if (year) {
      query.year = year;
    }

    if (isApproved !== undefined) {
      query.isApproved = isApproved;
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { rollNumber: searchRegex },
        { username: searchRegex },
      ];
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users with pagination
    const skip = (page - 1) * limit;
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('shop', 'name');

    const totalPages = Math.ceil(total / limit);

    return {
      users,
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
   * Update user role (superadmin only)
   */
  async updateUserRole(
    userId: string,
    role: UserRole,
    shopId?: string
  ): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Prevent changing superadmin role
    if (user.role === 'superadmin') {
      throw new UserError('Cannot change superadmin role', 'FORBIDDEN', 403);
    }

    // Validate shop requirement for captain/owner/accountant
    if (['captain', 'owner', 'accountant'].includes(role)) {
      if (!shopId) {
        throw new UserError(
          'Shop ID is required for captain, owner, or accountant roles',
          'SHOP_REQUIRED',
          400
        );
      }
      user.shop = new Types.ObjectId(shopId);
    } else {
      user.set('shop', undefined);
    }

    // Clear student-specific fields if changing from student
    if (user.role === 'student' && role !== 'student') {
      user.set('rollNumber', undefined);
      user.set('department', undefined);
      user.set('year', undefined);
    }

    user.role = role;
    await user.save();

    logger.info('User role updated', { userId, newRole: role, shopId });

    return user;
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: string): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.role === 'superadmin') {
      throw new UserError('Cannot deactivate superadmin', 'FORBIDDEN', 403);
    }

    user.isActive = false;
    await user.save();

    logger.info('User deactivated', { userId });

    return user;
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(userId: string): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    user.isActive = true;
    await user.save();

    logger.info('User reactivated', { userId });

    return user;
  }

  /**
   * Get user with wallet transactions summary
   */
  async getUserWithWalletSummary(userId: string): Promise<{
    user: IUserDocument;
    transactionCount: number;
    totalCredits: number;
    totalDebits: number;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Get transaction summary
    const TransactionModel = getCurrentTransactionModel();
    const summary = await TransactionModel.aggregate([
      { $match: { user: new Types.ObjectId(userId), status: 'completed' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCredits: {
            $sum: {
              $cond: [{ $in: ['$type', ['credit', 'refund']] }, '$amount', 0],
            },
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const stats = summary[0] || { count: 0, totalCredits: 0, totalDebits: 0 };

    return {
      user,
      transactionCount: stats.count,
      totalCredits: stats.totalCredits,
      totalDebits: stats.totalDebits,
    };
  }

  /**
   * Get student leaderboard based on total spending
   * Returns top students ranked by their total spent on completed orders
   */
  async getLeaderboard(limit: number = 50): Promise<{
    id: string;
    name: string;
    rollNumber: string;
    department: string;
    totalSpent: number;
    ordersCount: number;
    rank: number;
    avatarUrl: string | null;
  }[]> {
    // Aggregate orders to get total spent and order count per user
    const leaderboardData = await Order.aggregate([
      // Only count completed orders
      { $match: { status: 'completed' } },
      // Group by user
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$total' },
          ordersCount: { $sum: 1 },
        },
      },
      // Sort by total spent descending
      { $sort: { totalSpent: -1 } },
      // Limit results
      { $limit: limit },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      // Unwind the user array
      { $unwind: '$user' },
      // Filter only students who are active and approved
      {
        $match: {
          'user.role': 'student',
          'user.isActive': true,
          'user.isApproved': true,
        },
      },
      // Project the final shape
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          name: '$user.name',
          rollNumber: '$user.rollNumber',
          department: '$user.department',
          totalSpent: 1,
          ordersCount: 1,
          avatarUrl: { $ifNull: ['$user.avatarUrl', null] },
        },
      },
    ]);

    // Add rank and convert avatar URLs to proxy URLs
    const rankedLeaderboard = leaderboardData.map((entry, index) => ({
      ...entry,
      avatarUrl: entry.avatarUrl ? convertToProxyUrl(entry.avatarUrl) : null,
      rank: index + 1,
    }));

    logger.debug('Leaderboard fetched', { count: rankedLeaderboard.length });

    return rankedLeaderboard;
  }

  /**
   * Reset user password (superadmin only)
   */
  async resetPassword(userId: string, newPassword: string): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordHash = passwordHash;

    // Clear any account lockout
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;

    await user.save();

    logger.info('User password reset by superadmin', { userId, username: user.username });

    return user;
  }
}

// Export singleton instance
export const userService = new UserService();
