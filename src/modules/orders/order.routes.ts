/**
 * Order Routes
 * Express router configuration for order endpoints
 */

import { Router } from 'express';
import { orderController } from './order.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../shared/middleware/validate.middleware.js';
import {
  createOrderSchema,
  createLaundryOrderSchema,
  createXeroxOrderSchema,
  updateStatusSchema,
  verifyQrSchema,
  orderQuerySchema,
  orderIdParamSchema,
  cancelOrderSchema,
} from './order.validation.js';

// ============================================
// ROUTER CONFIGURATION
// ============================================

const router = Router();

// ============================================
// STATIC ROUTES FIRST (before parameterized routes)
// ============================================

/**
 * Get current student's orders
 * GET /api/v1/orders/my
 * Role: student
 */
router.get(
  '/my',
  requireAuth('student'),
  validateQuery(orderQuerySchema),
  orderController.getUserOrders
);

/**
 * Verify QR code for pickup
 * POST /api/v1/orders/verify-qr
 * Role: captain, owner
 */
router.post(
  '/verify-qr',
  requireAuth('captain', 'owner'),
  validate(verifyQrSchema),
  orderController.verifyQr
);

// ============================================
// SHOP ROUTES (before :id parameterized routes)
// ============================================

/**
 * Get shop orders (for captain/owner/superadmin)
 * GET /api/v1/orders/shop
 * Role: captain, owner, superadmin
 */
router.get(
  '/shop',
  requireAuth('captain', 'owner', 'superadmin'),
  validateQuery(orderQuerySchema),
  orderController.getShopOrders
);

/**
 * Get active shop orders
 * GET /api/v1/orders/shop/active
 * Role: captain, owner, superadmin
 */
router.get(
  '/shop/active',
  requireAuth('captain', 'owner', 'superadmin'),
  orderController.getActiveOrders
);

/**
 * Get shop order statistics
 * GET /api/v1/orders/shop/stats
 * Role: captain, owner, superadmin
 */
router.get(
  '/shop/stats',
  requireAuth('captain', 'owner', 'superadmin'),
  orderController.getStats
);

/**
 * Get shop analytics data
 * GET /api/v1/orders/shop/analytics
 * Role: captain, owner, superadmin
 */
router.get(
  '/shop/analytics',
  requireAuth('captain', 'owner', 'superadmin'),
  orderController.getAnalytics
);

// ============================================
// SERVICE ORDER ROUTES
// ============================================

/**
 * Create a laundry order
 * POST /api/v1/orders/laundry
 * Role: student
 */
router.post(
  '/laundry',
  requireAuth('student'),
  validate(createLaundryOrderSchema),
  orderController.createLaundryOrder
);

/**
 * Create a xerox order
 * POST /api/v1/orders/xerox
 * Role: student
 */
router.post(
  '/xerox',
  requireAuth('student'),
  validate(createXeroxOrderSchema),
  orderController.createXeroxOrder
);

// ============================================
// ROOT ROUTE
// ============================================

/**
 * Create a new food order
 * POST /api/v1/orders
 * Role: student
 */
router.post(
  '/',
  requireAuth('student'),
  validate(createOrderSchema),
  orderController.create
);

// ============================================
// PARAMETERIZED ROUTES (must be after static routes)
// ============================================

/**
 * Cancel an order (student only - pending orders)
 * POST /api/v1/orders/:id/cancel
 * Role: student
 */
router.post(
  '/:id/cancel',
  requireAuth('student'),
  validateParams(orderIdParamSchema),
  validate(cancelOrderSchema),
  orderController.cancel
);

/**
 * Update order status
 * PUT /api/v1/orders/:id/status
 * Role: captain, owner
 */
router.put(
  '/:id/status',
  requireAuth('captain', 'owner'),
  validateParams(orderIdParamSchema),
  validate(updateStatusSchema),
  orderController.updateStatus
);

/**
 * Complete order (after QR verification)
 * POST /api/v1/orders/:id/complete
 * Role: captain, owner
 */
router.post(
  '/:id/complete',
  requireAuth('captain', 'owner'),
  validateParams(orderIdParamSchema),
  orderController.complete
);

/**
 * Get order by ID (MUST BE LAST - catch-all for :id)
 * GET /api/v1/orders/:id
 * Role: authenticated (ownership checked in controller)
 */
router.get(
  '/:id',
  authenticate,
  validateParams(orderIdParamSchema),
  orderController.getById
);

// ============================================
// EXPORT
// ============================================

export default router;

// Also export with named export for flexibility
export { router as orderRoutes };
