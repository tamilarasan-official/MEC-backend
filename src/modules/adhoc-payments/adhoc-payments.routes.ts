/**
 * Ad-hoc Payments Routes
 * Defines all payment request-related API endpoints
 */

import { Router } from 'express';
import { adhocPaymentsController } from './adhoc-payments.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../shared/middleware/validate.middleware.js';
import {
  createPaymentRequestSchema,
  updatePaymentRequestSchema,
  closePaymentRequestSchema,
  paymentRequestFiltersSchema,
  studentPaymentFiltersSchema,
  historyFiltersSchema,
  requestIdParamSchema,
} from './adhoc-payments.validation.js';

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
  validate(createPaymentRequestSchema),
  adhocPaymentsController.createPaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments
 * @desc Get all payment requests with filters
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/',
  validateQuery(paymentRequestFiltersSchema),
  adhocPaymentsController.getPaymentRequests.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments/:id
 * @desc Get single payment request by ID
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/:id',
  validateParams(requestIdParamSchema),
  adhocPaymentsController.getPaymentRequestById.bind(adhocPaymentsController)
);

/**
 * @route PUT /api/v1/superadmin/payments/:id
 * @desc Update a payment request
 * @access Private (Superadmin)
 */
superadminRouter.put(
  '/:id',
  validateParams(requestIdParamSchema),
  validate(updatePaymentRequestSchema),
  adhocPaymentsController.updatePaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route POST /api/v1/superadmin/payments/:id/close
 * @desc Close or cancel a payment request
 * @access Private (Superadmin)
 */
superadminRouter.post(
  '/:id/close',
  validateParams(requestIdParamSchema),
  validate(closePaymentRequestSchema),
  adhocPaymentsController.closePaymentRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/superadmin/payments/:id/students
 * @desc Get students for a payment request with their payment status
 * @access Private (Superadmin)
 */
superadminRouter.get(
  '/:id/students',
  validateParams(requestIdParamSchema),
  validateQuery(studentPaymentFiltersSchema),
  adhocPaymentsController.getStudentsForRequest.bind(adhocPaymentsController)
);

/**
 * @route POST /api/v1/superadmin/payments/:id/remind
 * @desc Send payment reminders to unpaid students
 * @access Private (Superadmin)
 */
superadminRouter.post(
  '/:id/remind',
  validateParams(requestIdParamSchema),
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
  validateParams(requestIdParamSchema),
  adhocPaymentsController.payRequest.bind(adhocPaymentsController)
);

/**
 * @route GET /api/v1/student/payments/history
 * @desc Get payment history for student
 * @access Private (All authenticated users, typically students)
 */
studentRouter.get(
  '/history',
  validateQuery(historyFiltersSchema),
  adhocPaymentsController.getPaymentHistory.bind(adhocPaymentsController)
);

export { superadminRouter as adhocPaymentsSuperadminRoutes };
export { studentRouter as adhocPaymentsStudentRoutes };
