/**
 * Ad-hoc Payments Module
 *
 * This module handles ad-hoc payment requests from superadmins to students.
 * Features:
 * - Create payment requests targeting all students, specific students, departments, or years
 * - Students can view and pay pending payments via their wallet
 * - Track payment status and send reminders
 */

// Models
export { PaymentRequest, type IPaymentRequest, type IPaymentRequestDocument } from './payment-request.model.js';
export { PaymentSubmission, type IPaymentSubmission, type IPaymentSubmissionDocument } from './payment-submission.model.js';

// Service
export { adhocPaymentsService, AdhocPaymentsError } from './adhoc-payments.service.js';

// Controller
export { adhocPaymentsController } from './adhoc-payments.controller.js';

// Routes
export { adhocPaymentsSuperadminRoutes, adhocPaymentsStudentRoutes } from './adhoc-payments.routes.js';

// Validation schemas
export * from './adhoc-payments.validation.js';
