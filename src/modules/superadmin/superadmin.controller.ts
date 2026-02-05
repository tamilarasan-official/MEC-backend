/**
 * Superadmin Controller
 * Request handlers for superadmin dashboard and management
 */

import { Request, Response, NextFunction } from 'express';
import { superadminService } from './superadmin.service.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { HttpStatus } from '../../config/constants.js';
import {
  getExistingTransactionCollections,
  migrateExistingTransactions,
  getMonthlyCollectionName,
} from '../wallet/monthly-transaction.util.js';

// ============================================
// RESPONSE HELPERS
// ============================================

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

function successResponse<T>(data: T, message?: string): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  return response;
}

// ============================================
// CONTROLLER CLASS
// ============================================

export class SuperadminController {
  /**
   * Get dashboard statistics
   * GET /superadmin/dashboard/stats
   * Role: superadmin
   */
  getDashboardStats = asyncHandler(async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const stats = await superadminService.getDashboardStats();
    res.status(HttpStatus.OK).json(successResponse(stats));
  });

  /**
   * Get all orders across all shops
   * GET /superadmin/orders
   * Role: superadmin
   */
  getAllOrders = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { page = '1', limit = '20', status, shopId } = req.query;

    const result = await superadminService.getAllOrders({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string | undefined,
      shopId: shopId as string | undefined,
    });

    res.status(HttpStatus.OK).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get order statistics across all shops
   * GET /superadmin/orders/stats
   * Role: superadmin
   */
  getOrderStats = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { startDate, endDate } = req.query;

    const stats = await superadminService.getOrderStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.status(HttpStatus.OK).json(successResponse(stats));
  });

  /**
   * Get transaction collections status
   * GET /superadmin/transactions/collections
   * Role: superadmin
   */
  getTransactionCollections = asyncHandler(async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const collections = await getExistingTransactionCollections();
    const currentMonth = getMonthlyCollectionName(new Date());

    res.status(HttpStatus.OK).json(
      successResponse({
        currentCollection: currentMonth,
        existingCollections: collections,
        totalCollections: collections.length,
      })
    );
  });

  /**
   * Migrate existing transactions to monthly collections
   * POST /superadmin/transactions/migrate
   * Role: superadmin
   */
  migrateTransactions = asyncHandler(async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const result = await migrateExistingTransactions();

    res.status(HttpStatus.OK).json(
      successResponse(
        {
          migrated: result.migrated,
          errors: result.errors,
        },
        `Migration complete: ${result.migrated} transactions migrated, ${result.errors} errors`
      )
    );
  });
}

// Export singleton instance
export const superadminController = new SuperadminController();
export default superadminController;
