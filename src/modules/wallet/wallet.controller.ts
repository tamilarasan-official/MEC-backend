import { Request, Response, NextFunction } from 'express';
import { walletService, WalletError } from './wallet.service.js';
import {
  creditSchema,
  debitSchema,
  transactionFiltersSchema,
  accountantTransactionFiltersSchema,
} from './wallet.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

/**
 * Wallet Controller - Handles HTTP requests for wallet operations
 */
export class WalletController {
  /**
   * Get current user's wallet balance
   * GET /student/wallet
   */
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const { balance, user } = await walletService.getBalance(userId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          balance,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            rollNumber: user.rollNumber,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's transaction history
   * GET /student/wallet/transactions
   */
  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
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
      const validationResult = transactionFiltersSchema.safeParse(req.query);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const filters = validationResult.data;
      const result = await walletService.getTransactions(userId, filters);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.transactions,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Credit a student's wallet (accountant only)
   * POST /accountant/students/:id/credit
   */
  async creditStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;
      const studentId = req.params.id;

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

      if (!studentId) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Student ID is required',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = creditSchema.safeParse(req.body);

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

      const { amount, source, description } = validationResult.data;

      const result = await walletService.creditWallet(
        studentId,
        amount,
        source,
        description ?? undefined,
        adminId
      );

      logger.info('Student wallet credited', {
        adminId,
        studentId,
        amount,
        source,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.newBalance,
        },
        message: `Successfully credited ${amount} to student wallet`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof WalletError) {
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
   * Debit a student's wallet (accountant only)
   * POST /accountant/students/:id/debit
   */
  async debitStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;
      const studentId = req.params.id;

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

      if (!studentId) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Student ID is required',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = debitSchema.safeParse(req.body);

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

      const { amount, description } = validationResult.data;

      const result = await walletService.debitWallet(studentId, amount, description ?? '', adminId);

      logger.info('Student wallet debited', {
        adminId,
        studentId,
        amount,
        description,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.newBalance,
        },
        message: `Successfully debited ${amount} from student wallet`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof WalletError) {
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
   * Get all transactions with filters (accountant only)
   * GET /accountant/transactions
   */
  async getAllTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Validate query parameters
      const validationResult = accountantTransactionFiltersSchema.safeParse(req.query);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const filters = validationResult.data;
      const result = await walletService.getAllTransactions(filters);

      // Map transactions to include flat userId/userName from populated user field
      const transactions = result.transactions.map(tx => {
        const json = tx.toJSON();
        const user = json.user as { _id?: string; name?: string } | string | undefined;
        return {
          ...json,
          userId: typeof user === 'object' && user ? String(user._id || '') : String(user || ''),
          userName: typeof user === 'object' && user ? user.name : undefined,
        };
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          transactions,
          pagination: result.pagination,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor payables for all shops
   * GET /accountant/vendor-payables
   */
  async getVendorPayables(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const period = req.query.period as string | undefined;
      const result = await walletService.getVendorPayables(period);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update vendor transfer status
   * POST /accountant/vendor-transfers
   */
  async updateVendorTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Body is already validated by vendorTransferSchema middleware
      const { shopId, period, amount, status, notes } = req.body;

      const result = await walletService.updateVendorTransfer(
        shopId,
        period,
        amount,
        status,
        notes,
        adminId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        message: `Transfer ${status === 'completed' ? 'marked as completed' : 'updated'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const walletController = new WalletController();
