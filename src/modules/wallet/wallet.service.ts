import mongoose, { Types } from 'mongoose';
import { ITransactionDocument, CreditSource, WalletTransactionType } from './transaction.model.js';
import {
  getCurrentTransactionModel,
  queryTransactions,
  getUserTransactions,
} from './monthly-transaction.util.js';
import { User, IUserDocument } from '../users/user.model.js';
import { Order } from '../orders/order.model.js';
import { Shop } from '../shops/shop.model.js';
import { VendorTransfer } from './vendor-transfer.model.js';
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
   * Get user's transaction history with pagination (queries across monthly collections)
   */
  async getTransactions(userId: string, filters: TransactionFilters): Promise<PaginatedTransactions> {
    const { type, startDate, endDate, page = 1, limit = 20 } = filters;

    const skip = (page - 1) * limit;

    // Use the monthly transaction utility to query across collections
    const result = await getUserTransactions(new Types.ObjectId(userId), {
      type: type as WalletTransactionType | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      skip,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      transactions: result.transactions,
      pagination: {
        page,
        limit,
        total: result.total,
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
    source: CreditSource,
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

      // Create transaction record in monthly collection
      const transactionDescription =
        description || `Wallet credited via ${source === 'cash_deposit' ? 'cash deposit' : 'online payment'}`;

      const TransactionModel = getCurrentTransactionModel();
      const [transaction] = await TransactionModel.create(
        [
          {
            user: user._id,
            type: 'credit',
            amount,
            balanceBefore,
            balanceAfter,
            source,
            description: transactionDescription,
            status: 'completed',
            processedBy: new Types.ObjectId(adminId),
          },
        ],
        { session }
      );

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

      // Create transaction record in monthly collection
      const TransactionModel = getCurrentTransactionModel();
      const [transaction] = await TransactionModel.create(
        [
          {
            user: user._id,
            type: 'debit',
            amount,
            balanceBefore,
            balanceAfter,
            description,
            status: 'completed',
            processedBy: new Types.ObjectId(adminId),
          },
        ],
        { session }
      );

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

      // Create refund transaction in monthly collection
      const TransactionModel = getCurrentTransactionModel();
      const [transaction] = await TransactionModel.create(
        [
          {
            user: user._id,
            type: 'refund',
            amount,
            balanceBefore,
            balanceAfter,
            source: 'refund',
            description: description || `Refund for cancelled order`,
            status: 'completed',
            order: new Types.ObjectId(orderId),
          },
        ],
        { session }
      );

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

      // Create transaction record in monthly collection
      const TransactionModel = getCurrentTransactionModel();
      const [transaction] = await TransactionModel.create(
        [
          {
            user: user._id,
            type: 'debit',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Payment for order`,
            status: 'completed',
            order: new Types.ObjectId(orderId),
          },
        ],
        { session }
      );

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
   * Get all transactions (for accountant) - queries across monthly collections
   */
  async getAllTransactions(filters: AccountantTransactionFilters): Promise<PaginatedTransactions> {
    const { userId, type, source, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const skip = (page - 1) * limit;

    // Use the monthly transaction utility to query across collections
    const result = await queryTransactions({
      user: userId ? new Types.ObjectId(userId) : undefined,
      type: type as WalletTransactionType | undefined,
      source: source,
      status: status as 'pending' | 'completed' | 'failed' | 'cancelled' | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      skip,
      populate: ['user', 'processedBy', 'order'],
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      transactions: result.transactions,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get vendor payables for all shops for a given period (month)
   * Aggregates completed orders by shop, computes revenue, estimated cost (60%), and profit margin
   */
  async getVendorPayables(period?: string): Promise<{
    payables: Array<{
      shopId: string;
      shopName: string;
      category: string;
      revenue: number;
      estimatedCost: number;
      profitMargin: number;
      payableAmount: number;
      orderCount: number;
      transferStatus: string;
      transferId?: string;
      completedAt?: string;
    }>;
    period: string;
  }> {
    // Default to current month
    const now = new Date();
    const targetPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Parse period
    const [yearStr, monthStr] = targetPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Aggregate completed orders by shop for the period
    const orderStats = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$shop',
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
          estimatedCost: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $multiply: ['$$item.price', '$$item.quantity', 0.6] },
                },
              },
            },
          },
        },
      },
    ]);

    // Get all shops
    const shops = await Shop.find({}).lean();
    const shopMap = new Map(shops.map(s => [s._id.toString(), s]));

    // Get existing transfers for this period
    const transfers = await VendorTransfer.find({ period: targetPeriod }).lean();
    const transferMap = new Map(transfers.map(t => [t.shop.toString(), t]));

    // Build payables array
    const payables = orderStats
      .filter(stat => shopMap.has(stat._id.toString()))
      .map(stat => {
        const shop = shopMap.get(stat._id.toString())!;
        const transfer = transferMap.get(stat._id.toString());
        const revenue = stat.revenue;
        const estimatedCost = stat.estimatedCost;
        const profit = Math.max(0, revenue - estimatedCost);
        const profitMarginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
        // Payable to vendor = estimated cost of goods (vendor's share)
        const payableAmount = estimatedCost;

        return {
          shopId: stat._id.toString(),
          shopName: shop.name,
          category: shop.category,
          revenue: Math.round(revenue),
          estimatedCost: Math.round(estimatedCost),
          profitMargin: profitMarginPct,
          payableAmount: Math.round(payableAmount),
          orderCount: stat.orderCount as number,
          transferStatus: transfer?.status || 'pending',
          transferId: transfer?._id?.toString(),
          completedAt: transfer?.completedAt?.toISOString(),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return { payables, period: targetPeriod };
  }

  /**
   * Update vendor transfer status (mark as completed or create new)
   */
  async updateVendorTransfer(
    shopId: string,
    period: string,
    amount: number,
    status: 'pending' | 'completed',
    notes: string | undefined,
    processedBy: string
  ): Promise<Record<string, unknown>> {
    const shopObjectId = new Types.ObjectId(shopId);
    const processedByObjectId = new Types.ObjectId(processedBy);

    // Upsert: create or update
    const transfer = await VendorTransfer.findOneAndUpdate(
      { shop: shopObjectId, period },
      {
        $set: {
          amount,
          status,
          notes: notes || undefined,
          processedBy: processedByObjectId,
          ...(status === 'completed' ? { completedAt: new Date() } : {}),
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).populate('shop', 'name');

    logger.info('Vendor transfer updated', {
      shopId,
      period,
      amount,
      status,
      processedBy,
    });

    return transfer.toJSON();
  }
}

// Export singleton instance
export const walletService = new WalletService();
