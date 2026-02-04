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
// STUDENT ROUTES
// ============================================

/**
 * Create a new order
 * POST /api/v1/orders
 * Role: student
 */
router.post(
  '/',
  requireAuth('student'),
  orderController.create
);

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
 * Cancel an order (student only - pending orders)
 * POST /api/v1/orders/:id/cancel
 * Role: student
 */
router.post(
  '/:id/cancel',
  requireAuth('student'),
  orderController.cancel
);

// ============================================
// CAPTAIN/OWNER ROUTES
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
 * Verify QR code for pickup
 * POST /api/v1/orders/verify-qr
 * Role: captain, owner
 */
router.post(
  '/verify-qr',
  requireAuth('captain', 'owner'),
  orderController.verifyQr
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

// ============================================
// COMMON ROUTES
// ============================================

/**
 * Get order by ID
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
