/**
 * Middleware Index
 * Re-exports all middleware for convenient importing
 */

// Authentication
export {
  authenticate,
  optionalAuthenticate,
  requireAuth,
  generateToken,
  generateRefreshToken,
} from './auth.middleware.js';

// Error handling
export {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
} from './error.middleware.js';

// RBAC (Role-Based Access Control)
export {
  requireRole,
  requireMinimumRole,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  checkShopAccess,
  checkOwnershipOrAdmin,
  checkStrictOwnership,
  hasPermission,
  hasRole,
  hasMinimumRole,
  getRolePermissions,
} from './rbac.middleware.js';

// Rate Limiting
export {
  generalRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  otpRateLimiter,
  adminRateLimiter,
  uploadRateLimiter,
  searchRateLimiter,
  orderRateLimiter,
  paymentRateLimiter,
  createCustomRateLimiter,
  slidingWindowRateLimiter,
} from './rate-limit.middleware.js';

// Validation
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateRequest,
  objectIdSchema,
  paginationQuerySchema,
  sortQuerySchema,
  idParamsSchema,
  emailSchema,
  phoneSchema,
  passwordSchema,
} from './validate.middleware.js';

export type { ValidationSource, ValidationOptions } from './validate.middleware.js';
