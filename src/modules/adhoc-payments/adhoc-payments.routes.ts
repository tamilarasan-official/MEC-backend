/**
 * Ad-hoc Payments Routes
 * Defines all payment request-related API endpoints
 */

import { Router } from 'express';
import { adhocPaymentsController } from './adhoc-payments.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';

// ============================================
// SUPERADMIN ROUTES
// ============================================

const superadminRouter = Router();

// All superadmin routes require superadmin role
superadminRouter.use(requireAuth('superadmin', 'super_admin'));

/**
 * @route POST /api/v1/superadmin/payments
 * @desc Create a new payment request
 * @access Private (Superadmin)
 */
superadminRouter.post(
  '/',
  adhocPaymentsController.createPaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments
 * @desc Get all payment requests with filters
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/',
  adhocPaymentsController.getPaymentRequests.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments/:id
 * @desc Get single payment request by ID
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/:id',
  adhocPaymentsController.getPaymentRequestById.bind(adhocPaymentsController)
);

/**
 * @route PUT /api/v1/superadmin/payments/:id
 * @desc Update a payment request
 * @access Private (Superadmin)
 */
superadminRouter.put(
  '/:id',
  adhocPaymentsController.updatePaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route POST /api/v1/superadmin/payments/:id/close
 * @desc Close or cancel a payment request
 * @access Private (Superadmin)
 */
superadminRouter.post(
  '/:id/close',
  adhocPaymentsController.closePaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments/:id/students
 * @desc Get students for a payment request with their payment status
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/:id/students',
  adhocPaymentsController.getStudentsForRequest.bind(adhocPaymentsController)
);

/**
 * @route POST /api/v1/superadmin/payments/:id/remind
 * @desc Send payment reminders to unpaid students
 * @access Private (Superadmin)
 */
superadminRouter.post(
  '/:id/remind',
  adhocPaymentsController.sendReminders.bind(adhocPaymentsController)
);

// ============================================
// STUDENT ROUTES
// ============================================

const studentRouter = Router();

// All student routes require authentication
studentRouter.use(authenticate);

/**
 * @route GET /api/v1/student/payments/pending
 * @desc Get pending payments for logged-in student
 * @access Private (All authenticated users, typically students)
 */
studentRouter.get(
  '/pending',
  adhocPaymentsController.getPendingPayments.bind(adhocPaymentsController)
);

/**
 * @route POST /api/v1/student/payments/:id/pay
 * @desc Pay a pending payment request
 * @access Private (All authenticated users, typically students)
 */
studentRouter.post(
  '/:id/pay',
  adhocPaymentsController.payRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/student/payments/history
 * @desc Get payment history for student
 * @access Private (All authenticated users, typically students)
 */
studentRouter.get(
  '/history',
  adhocPaymentsController.getPaymentHistory.bind(adhocPaymentsController)
);

export { superadminRouter as adhocPaymentsSuperadminRoutes };
export { studentRouter as adhocPaymentsStudentRoutes };
