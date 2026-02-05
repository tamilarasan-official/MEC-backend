/**
 * Order Routes
 * Express router configuration for order endpoints
 */

import { Router } from 'express';
import { orderController } from './order.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';

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
  orderController.getById
);

// ============================================
// EXPORT
// ============================================

export default router;

// Also export with named export for flexibility
export { router as orderRoutes };
