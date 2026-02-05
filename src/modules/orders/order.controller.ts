/**
 * Order Controller
 * Request handlers for order management
 */

import { Request, Response, NextFunction } from 'express';
import { orderService } from './order.service.js';
import {
  validateCreateOrder,
  validateUpdateStatus,
  validateVerifyQr,
  validateOrderQuery,
  validateOrderIdParam,
  validateCancelOrder,
  validateCreateLaundryOrder,
  validateCreateXeroxOrder,
} from './order.validation.js';
import { AppError, asyncHandler } from '../../shared/middleware/error.middleware.js';
import { HttpStatus } from '../../config/constants.js';
import { orderEvents } from './order.events.js';
import { logger } from '../../config/logger.js';
import { AuthUser } from '../../shared/types/index.js';

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

export class OrderController {
  /**
   * Create a new order
   * POST /orders
   * Role: student
   */
  create = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate request body
    const validation = validateCreateOrder(req.body);
    if (!validation.success) {
      throw AppError.validation('Validation failed', validation.errors);
    }

    // Create order
    const result = await orderService.createOrder(user.id, validation.data);

    // Emit new order event to shop
    orderEvents.emitNewOrder(validation.data.shopId, result.order);

    res.status(HttpStatus.CREATED).json(
      successResponse(
        {
          order: result.order,
          qrData: result.qrData,
        },
        'Order created successfully'
      )
    );
  });

  /**
   * Create a laundry order
   * POST /orders/laundry
   * Role: student
   */
  createLaundryOrder = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate request body
    const validation = validateCreateLaundryOrder(req.body);
    if (!validation.success) {
      throw AppError.validation('Validation failed', validation.errors);
    }

    // Create laundry order
    const result = await orderService.createLaundryOrder(user.id, validation.data);

    // Emit new order event to shop
    orderEvents.emitNewOrder(validation.data.shopId, result.order);

    res.status(HttpStatus.CREATED).json(
      successResponse(
        {
          order: result.order,
          qrData: result.qrData,
        },
        'Laundry order created successfully'
      )
    );
  });

  /**
   * Create a xerox order
   * POST /orders/xerox
   * Role: student
   */
  createXeroxOrder = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate request body
    const validation = validateCreateXeroxOrder(req.body);
    if (!validation.success) {
      throw AppError.validation('Validation failed', validation.errors);
    }

    // Create xerox order
    const result = await orderService.createXeroxOrder(user.id, validation.data);

    // Emit new order event to shop
    orderEvents.emitNewOrder(validation.data.shopId, result.order);

    res.status(HttpStatus.CREATED).json(
      successResponse(
        {
          order: result.order,
          qrData: result.qrData,
        },
        'Xerox order created successfully'
      )
    );
  });

  /**
   * Get order by ID
   * GET /orders/:id
   */
  getById = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate params
    const paramValidation = validateOrderIdParam(req.params);
    if (!paramValidation.success) {
      throw AppError.validation('Invalid order ID', paramValidation.errors);
    }

    // Determine if we should check ownership
    const checkOwnership = user.role === 'student';
    const order = await orderService.getOrderById(
      paramValidation.data.id,
      checkOwnership ? user.id : undefined
    );

    res.json(successResponse(order));
  });

  /**
   * Get orders for the current student
   * GET /student/orders
   * Role: student
   */
  getUserOrders = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate query params
    const queryValidation = validateOrderQuery(req.query);
    if (!queryValidation.success) {
      throw AppError.validation('Invalid query parameters', queryValidation.errors);
    }

    const result = await orderService.getUserOrders(user.id, queryValidation.data);

    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get shop orders
   * GET /orders/shop
   * Role: captain, owner, superadmin
   * Returns orders filtered by shop (superadmin can view all or specific shop)
   */
  getShopOrders = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate query params
    const queryValidation = validateOrderQuery(req.query);
    if (!queryValidation.success) {
      throw AppError.validation('Invalid query parameters', queryValidation.errors);
    }

    // Determine shop ID based on role
    let shopId: string | undefined;
    if (user.role === 'superadmin') {
      // Superadmin can access any shop's orders via query param, or all if not specified
      shopId = req.query['shopId'] as string | undefined;
    } else {
      // Captain/Owner must be assigned to a shop and can only see their shop's orders
      if (!user.shopId) {
        throw AppError.forbidden('You are not assigned to a shop');
      }
      shopId = user.shopId;
    }

    const result = await orderService.getShopOrders(shopId, queryValidation.data);

    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get active orders
   * GET /orders/shop/active
   * Role: captain, owner, superadmin
   * Returns active orders (pending, preparing, ready) filtered by shop
   */
  getActiveOrders = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Determine shop ID based on role
    let shopId: string | undefined;
    if (user.role === 'superadmin') {
      // Superadmin can access any shop's orders via query param, or all if not specified
      shopId = req.query['shopId'] as string | undefined;
      logger.info('Superadmin fetching active orders', { shopId: shopId || 'all' });
    } else {
      // Captain/Owner must be assigned to a shop and can only see their shop's orders
      if (!user.shopId) {
        throw AppError.forbidden('You are not assigned to a shop');
      }
      shopId = user.shopId;
      logger.info('Fetching active orders for shop', { shopId, userId: user.id });
    }

    const orders = await orderService.getActiveShopOrders(shopId);
    logger.info(`Found ${orders.length} active orders`);

    res.json(successResponse(orders));
  });

  /**
   * Update order status
   * PUT /orders/:id/status
   * Role: captain, owner
   */
  updateStatus = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate params
    const paramValidation = validateOrderIdParam(req.params);
    if (!paramValidation.success) {
      throw AppError.validation('Invalid order ID', paramValidation.errors);
    }

    // Validate body
    const bodyValidation = validateUpdateStatus(req.body);
    if (!bodyValidation.success) {
      throw AppError.validation('Validation failed', bodyValidation.errors);
    }

    // Update status
    const order = await orderService.updateOrderStatus(
      paramValidation.data.id,
      bodyValidation.data.status,
      user.id,
      bodyValidation.data.cancellationReason
    );

    // Emit status change event
    orderEvents.emitStatusChange(order.user._id.toString(), order);

    // If order is ready, emit ready notification
    if (bodyValidation.data.status === 'ready') {
      orderEvents.emitOrderReady(order.user._id.toString(), order);
    }

    res.json(successResponse(order, `Order status updated to ${bodyValidation.data.status}`));
  });

  /**
   * Cancel order (student only)
   * POST /orders/:id/cancel
   * Role: student
   */
  cancel = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate params
    const paramValidation = validateOrderIdParam(req.params);
    if (!paramValidation.success) {
      throw AppError.validation('Invalid order ID', paramValidation.errors);
    }

    // Validate body
    const bodyValidation = validateCancelOrder(req.body);
    if (!bodyValidation.success) {
      throw AppError.validation('Validation failed', bodyValidation.errors);
    }

    // Cancel order
    const order = await orderService.cancelOrderByStudent(
      paramValidation.data.id,
      user.id,
      bodyValidation.data.reason
    );

    // Emit status change event
    orderEvents.emitStatusChange(order.user._id.toString(), order);

    res.json(successResponse(order, 'Order cancelled successfully. Amount refunded to wallet.'));
  });

  /**
   * Verify QR code for pickup
   * POST /orders/verify-qr
   * Role: captain, owner
   */
  verifyQr = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    if (!user.shopId) {
      throw AppError.forbidden('You are not assigned to a shop');
    }

    // Validate body
    const validation = validateVerifyQr(req.body);
    if (!validation.success) {
      throw AppError.validation('Validation failed', validation.errors);
    }

    // Verify QR
    const order = await orderService.verifyQr(validation.data.qrData, user.shopId);

    res.json(successResponse(order, 'QR code verified. Order is ready for pickup.'));
  });

  /**
   * Complete order (after QR verification)
   * POST /orders/:id/complete
   * Role: captain, owner
   */
  complete = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Validate params
    const paramValidation = validateOrderIdParam(req.params);
    if (!paramValidation.success) {
      throw AppError.validation('Invalid order ID', paramValidation.errors);
    }

    // Complete order
    const order = await orderService.completeOrder(paramValidation.data.id, user.id);

    // Emit status change event
    orderEvents.emitStatusChange(order.user._id.toString(), order);

    res.json(successResponse(order, 'Order completed successfully'));
  });

  /**
   * Get order statistics for shop
   * GET /captain/orders/stats
   * Role: captain, owner, superadmin
   */
  getStats = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Superadmin can access any shop's stats via query param
    let shopId = user.shopId;
    if (user.role === 'superadmin') {
      shopId = req.query['shopId'] as string | undefined;
    } else if (!shopId) {
      throw AppError.forbidden('You are not assigned to a shop');
    }

    const { startDate, endDate } = req.query;

    const stats = await orderService.getShopOrderStats(
      shopId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(successResponse(stats));
  });

  /**
   * Get analytics data for shop
   * GET /orders/shop/analytics
   * Role: captain, owner, superadmin
   */
  getAnalytics = asyncHandler(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser;

    // Superadmin can access any shop's analytics via query param
    let shopId = user.shopId;
    if (user.role === 'superadmin') {
      shopId = req.query['shopId'] as string | undefined;
    } else if (!shopId) {
      throw AppError.forbidden('You are not assigned to a shop');
    }

    const analytics = await orderService.getShopAnalytics(shopId);

    res.json(successResponse(analytics));
  });
}

// Export singleton instance
export const orderController = new OrderController();

export default orderController;
