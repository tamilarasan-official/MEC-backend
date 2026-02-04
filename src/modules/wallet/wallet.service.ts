import mongoose, { Types, FilterQuery } from 'mongoose';
import { Transaction, ITransactionDocument, CreditSource } from './transaction.model.js';
import { User, IUserDocument } from '../users/user.model.js';
import { logger } from '../../config/logger.js';

// Custom error class for wallet operations
export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

// Types for service parameters
export interface TransactionFilters {
  type?: 'credit' | 'debit' | 'refund' | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AccountantTransactionFilters extends TransactionFilters {
  userId?: string | undefined;
  source?: CreditSource | undefined;
  status?: string | undefined;
}

export interface TransactionResult {
  transaction: ITransactionDocument;
  newBalance: number;
}

export interface PaginatedTransactions {
  transactions: ITransactionDocument[];
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
 * Wallet Service - Handles all wallet-related operations
 */
export class WalletService {
  /**
   * Get user's current wallet balance
   */
  async getBalance(userId: string): Promise<{ balance: number; user: IUserDocument }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new WalletError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (!user.isActive) {
      throw new WalletError('User account is deactivated', 'USER_INACTIVE', 403);
    }

    return {
      balance: user.balance,
      user,
    };
  }

  /**
   * Get user's transaction history with pagination
   */
  async getTransactions(userId: string, filters: TransactionFilters): Promise<PaginatedTransactions> {
    const { type, startDate, endDate, page = 1, limit = 20 } = filters;

    // Build query
    const query: FilterQuery<ITransactionDocument> = {
      user: new Types.ObjectId(userId),
    };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await Transaction.countDocuments(query);

    // Get transactions with pagination
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('processedBy', 'name')
      .populate('order', 'orderNumber');

    const totalPages = Math.ceil(total / limit);

    return {
      transactions,
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
   * Credit a user's wallet (add funds)
   */
  async creditWallet(
    userId: string,
    amount: number,
    source: 'cash_deposit' | 'online_payment',
    description: string | undefined,
    adminId: string
  ): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with session
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new WalletError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (!user.isActive) {
        throw new WalletError('User account is deactivated', 'USER_INACTIVE', 403);
      }

      if (!user.isApproved) {
        throw new WalletError('User is not approved', 'USER_NOT_APPROVED', 403);
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore + amount;

      // Update user balance
      user.balance = balanceAfter;
      await user.save({ session });

      // Create transaction record
      const transactionDescription =
        description || `Wallet credited via ${source === 'cash_deposit' ? 'cash deposit' : 'online payment'}`;

      const transaction = new Transaction({
        user: user._id,
        type: 'credit',
        amount,
        balanceBefore,
        balanceAfter,
        source,
        description: transactionDescription,
        status: 'completed',
        processedBy: new Types.ObjectId(adminId),
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();

      logger.info('Wallet credited successfully', {
        userId,
        amount,
        source,
        adminId,
        newBalance: balanceAfter,
      });

      return {
        transaction,
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
   * Debit a user's wallet (withdraw funds)
   */
  async debitWallet(
    userId: string,
    amount: number,
    description: string,
    adminId: string
  ): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with session
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new WalletError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (!user.isActive) {
        throw new WalletError('User account is deactivated', 'USER_INACTIVE', 403);
      }

      if (!user.isApproved) {
        throw new WalletError('User is not approved', 'USER_NOT_APPROVED', 403);
      }

      // Check sufficient balance
      if (user.balance < amount) {
        throw new WalletError(
          `Insufficient balance. Current balance: ${user.balance}, Required: ${amount}`,
          'INSUFFICIENT_BALANCE',
          400
        );
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - amount;

      // Update user balance
      user.balance = balanceAfter;
      await user.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        user: user._id,
        type: 'debit',
        amount,
        balanceBefore,
        balanceAfter,
        description,
        status: 'completed',
        processedBy: new Types.ObjectId(adminId),
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();

      logger.info('Wallet debited successfully', {
        userId,
        amount,
        description,
        adminId,
        newBalance: balanceAfter,
      });

      return {
        transaction,
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
   * Refund an order amount to user's wallet
   */
  async refundOrder(
    userId: string,
    orderId: string,
    amount: number,
    description?: string
  ): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with session
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new WalletError('User not found', 'USER_NOT_FOUND', 404);
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore + amount;

      // Update user balance
      user.balance = balanceAfter;
      await user.save({ session });

      // Create refund transaction
      const transaction = new Transaction({
        user: user._id,
        type: 'refund',
        amount,
        balanceBefore,
        balanceAfter,
        source: 'refund',
        description: description || `Refund for cancelled order`,
        status: 'completed',
        order: new Types.ObjectId(orderId),
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();

      logger.info('Order refunded to wallet', {
        userId,
        orderId,
        amount,
        newBalance: balanceAfter,
      });

      return {
        transaction,
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
   * Debit wallet for order payment (internal use)
   */
  async debitForOrder(
    userId: string,
    orderId: string,
    amount: number
  ): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with session
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new WalletError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (!user.isActive) {
        throw new WalletError('User account is deactivated', 'USER_INACTIVE', 403);
      }

      // Check sufficient balance
      if (user.balance < amount) {
        throw new WalletError(
          `Insufficient balance. Current balance: ${user.balance}, Required: ${amount}`,
          'INSUFFICIENT_BALANCE',
          400
        );
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - amount;

      // Update user balance
      user.balance = balanceAfter;
      await user.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        user: user._id,
        type: 'debit',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Payment for order`,
        status: 'completed',
        order: new Types.ObjectId(orderId),
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();

      logger.info('Wallet debited for order', {
        userId,
        orderId,
        amount,
        newBalance: balanceAfter,
      });

      return {
        transaction,
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
   * Get all transactions (for accountant)
   */
  async getAllTransactions(filters: AccountantTransactionFilters): Promise<PaginatedTransactions> {
    const { userId, type, source, status, startDate, endDate, page = 1, limit = 20 } = filters;

    // Build query
    const query: FilterQuery<ITransactionDocument> = {};

    if (userId) {
      query.user = new Types.ObjectId(userId);
    }

    if (type) {
      query.type = type;
    }

    if (source) {
      query.source = source;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await Transaction.countDocuments(query);

    // Get transactions with pagination
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email rollNumber')
      .populate('processedBy', 'name')
      .populate('order', 'orderNumber');

    const totalPages = Math.ceil(total / limit);

    return {
      transactions,
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
export const walletService = new WalletService();
