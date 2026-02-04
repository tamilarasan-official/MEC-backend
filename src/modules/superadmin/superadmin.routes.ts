/**
 * Superadmin Routes
 * Express router for superadmin-specific endpoints
 */

import { Router } from 'express';
import { superadminController } from './superadmin.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';

// ============================================
// ROUTER CONFIGURATION
// ============================================

const router = Router();

// All routes require superadmin role
router.use(requireAuth('superadmin'));

// ============================================
// DASHBOARD ROUTES
// ============================================

/**
 * Get dashboard statistics
 * GET /api/v1/superadmin/dashboard/stats
 * Role: superadmin
 */
router.get('/dashboard/stats', superadminController.getDashboardStats);

/**
 * Get all orders across all shops
 * GET /api/v1/superadmin/orders
 * Role: superadmin
 */
router.get('/orders', superadminController.getAllOrders);

/**
 * Get order statistics across all shops
 * GET /api/v1/superadmin/orders/stats
 * Role: superadmin
 */
router.get('/orders/stats', superadminController.getOrderStats);

// ============================================
// EXPORT
// ============================================

export default router;
export { router as superadminRoutes };
