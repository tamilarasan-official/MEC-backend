/**
 * Wallet Routes
 * Defines all wallet-related API endpoints
 */

import { Router } from 'express';
import { walletController } from './wallet.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { vendorTransferSchema } from './wallet.validation.js';

const router = Router();

// ============================================
// STUDENT ROUTES
// ============================================

/**
 * @route GET /api/v1/student/wallet
 * @desc Get current user's wallet balance
 * @access Private (Student)
 */
router.get(
  '/student/wallet',
  authenticate,
  walletController.getBalance.bind(walletController)
);

/**
 * @route GET /api/v1/student/wallet/transactions
 * @desc Get current user's transaction history
 * @access Private (Student)
 */
router.get(
  '/student/wallet/transactions',
  authenticate,
  walletController.getTransactions.bind(walletController)
);

// ============================================
// ACCOUNTANT ROUTES
// ============================================

/**
 * @route POST /api/v1/accountant/students/:id/credit
 * @desc Credit a student's wallet
 * @access Private (Accountant, Owner, Superadmin)
 */
router.post(
  '/accountant/students/:id/credit',
  requireAuth('accountant', 'owner', 'superadmin', 'admin', 'super_admin'),
  walletController.creditStudent.bind(walletController)
);

/**
 * @route POST /api/v1/accountant/students/:id/debit
 * @desc Debit a student's wallet
 * @access Private (Accountant, Owner, Superadmin)
 */
router.post(
  '/accountant/students/:id/debit',
  requireAuth('accountant', 'owner', 'superadmin', 'admin', 'super_admin'),
  walletController.debitStudent.bind(walletController)
);

/**
 * @route GET /api/v1/accountant/transactions
 * @desc Get all transactions with filters
 * @access Private (Accountant, Owner, Captain, Superadmin)
 */
router.get(
  '/accountant/transactions',
  requireAuth('accountant', 'owner', 'captain', 'superadmin', 'admin', 'super_admin'),
  walletController.getAllTransactions.bind(walletController)
);

/**
 * @route GET /api/v1/accountant/vendor-payables
 * @desc Get vendor payable amounts for all shops
 * @access Private (Accountant, Superadmin)
 */
router.get(
  '/accountant/vendor-payables',
  requireAuth('accountant', 'superadmin', 'admin', 'super_admin'),
  walletController.getVendorPayables.bind(walletController)
);

/**
 * @route POST /api/v1/accountant/vendor-transfers
 * @desc Update vendor transfer status
 * @access Private (Accountant, Superadmin)
 */
router.post(
  '/accountant/vendor-transfers',
  requireAuth('accountant', 'superadmin', 'admin', 'super_admin'),
  validate(vendorTransferSchema),
  walletController.updateVendorTransfer.bind(walletController)
);

export default router;
