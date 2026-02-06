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
// TRANSACTION MANAGEMENT ROUTES
// ============================================

/**
 * Get transaction collection status (monthly collections info)
 * GET /api/v1/superadmin/transactions/collections
 * Role: superadmin
 */
router.get('/transactions/collections', superadminController.getTransactionCollections);

/**
 * Migrate existing transactions to monthly collections
 * POST /api/v1/superadmin/transactions/migrate
 * Role: superadmin
 */
router.post('/transactions/migrate', superadminController.migrateTransactions);

// ============================================
// DIAGNOSTIC & FIX ROUTES
// ============================================

/**
 * Diagnose owner-shop relationships
 * GET /api/v1/superadmin/diagnose/owner-shop
 * Role: superadmin
 * Returns: List of owners and shops with their relationships and any issues found
 */
router.get('/diagnose/owner-shop', superadminController.diagnoseOwnerShopLinks);

/**
 * Link an owner to a shop (fix broken relationships)
 * POST /api/v1/superadmin/fix/owner-shop
 * Body: { ownerId: string, shopId: string }
 * Role: superadmin
 */
router.post('/fix/owner-shop', superadminController.linkOwnerToShop);

// ============================================
// EXPORT
// ============================================

export default router;
export { router as superadminRoutes };
