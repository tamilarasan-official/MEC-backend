/**
 * User Routes
 * Defines all user-related API endpoints
 */

import { Router } from 'express';
import { userController } from './user.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// ============================================
// STUDENT ROUTES
// ============================================

/**
 * @route GET /api/v1/student/profile
 * @desc Get current user's profile
 * @access Private (Any authenticated user)
 */
router.get(
  '/student/profile',
  authenticate,
  userController.getProfile.bind(userController)
);

/**
 * @route PUT /api/v1/student/profile
 * @desc Update current user's profile
 * @access Private (Any authenticated user)
 */
router.put(
  '/student/profile',
  authenticate,
  userController.updateProfile.bind(userController)
);

/**
 * @route GET /api/v1/student/leaderboard
 * @desc Get student leaderboard ranked by total spending
 * @access Private (Any authenticated user - typically students)
 */
router.get(
  '/student/leaderboard',
  authenticate,
  userController.getLeaderboard.bind(userController)
);

// ============================================
// ACCOUNTANT ROUTES
// ============================================

/**
 * @route GET /api/v1/accountant/pending-approvals
 * @desc Get list of pending user approvals
 * @access Private (Accountant, Owner, Captain, Superadmin)
 */
router.get(
  '/accountant/pending-approvals',
  requireAuth('accountant', 'owner', 'captain', 'superadmin', 'admin', 'super_admin'),
  userController.getPendingApprovals.bind(userController)
);

/**
 * @route PUT /api/v1/accountant/approve/:id
 * @desc Approve a user
 * @access Private (Accountant, Owner, Superadmin)
 */
router.put(
  '/accountant/approve/:id',
  requireAuth('accountant', 'owner', 'superadmin', 'admin', 'super_admin'),
  userController.approveUser.bind(userController)
);

/**
 * @route PUT /api/v1/accountant/reject/:id
 * @desc Reject a user
 * @access Private (Accountant, Owner, Superadmin)
 */
router.put(
  '/accountant/reject/:id',
  requireAuth('accountant', 'owner', 'superadmin', 'admin', 'super_admin'),
  userController.rejectUser.bind(userController)
);

/**
 * @route GET /api/v1/accountant/students
 * @desc Get all approved students
 * @access Private (Accountant, Owner, Captain, Superadmin)
 */
router.get(
  '/accountant/students',
  requireAuth('accountant', 'owner', 'captain', 'superadmin', 'admin', 'super_admin'),
  userController.getStudents.bind(userController)
);

/**
 * @route GET /api/v1/accountant/students/:id
 * @desc Get a specific student with wallet summary
 * @access Private (Accountant, Owner, Captain, Superadmin)
 */
router.get(
  '/accountant/students/:id',
  requireAuth('accountant', 'owner', 'captain', 'superadmin', 'admin', 'super_admin'),
  userController.getStudentById.bind(userController)
);

// ============================================
// SUPERADMIN ROUTES
// ============================================

/**
 * @route GET /api/v1/superadmin/users
 * @desc Get all users with filters
 * @access Private (Superadmin only)
 */
router.get(
  '/superadmin/users',
  requireAuth('superadmin', 'super_admin'),
  userController.getAllUsers.bind(userController)
);

/**
 * @route PUT /api/v1/superadmin/users/:id/role
 * @desc Update a user's role
 * @access Private (Superadmin only)
 */
router.put(
  '/superadmin/users/:id/role',
  requireAuth('superadmin', 'super_admin'),
  userController.updateRole.bind(userController)
);

/**
 * @route PUT /api/v1/superadmin/users/:id/deactivate
 * @desc Deactivate a user
 * @access Private (Superadmin only)
 */
router.put(
  '/superadmin/users/:id/deactivate',
  requireAuth('superadmin', 'super_admin'),
  userController.deactivateUser.bind(userController)
);

/**
 * @route PUT /api/v1/superadmin/users/:id/reactivate
 * @desc Reactivate a user
 * @access Private (Superadmin only)
 */
router.put(
  '/superadmin/users/:id/reactivate',
  requireAuth('superadmin', 'super_admin'),
  userController.reactivateUser.bind(userController)
);

export default router;
