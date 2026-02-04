/**
 * Auth Module Index
 * Central export point for all auth module components
 */

// Validation
export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  validate,
  validateQuery,
  validateParams,
  type RegisterInput,
  type LoginInput,
  type RefreshTokenInput,
} from './auth.validation.js';

// Service
export {
  authService,
  AuthService,
  AuthError,
  type RegisterData,
  type LoginResult,
  type TokenPayload,
  type RefreshTokenPayload,
  type UserPublicData,
} from './auth.service.js';

// Controller
export {
  authController,
  register,
  login,
  refresh,
  logout,
  me,
} from './auth.controller.js';

// Middleware
export {
  authenticate,
  optionalAuth,
  authorize,
  shopAccess,
  authMiddleware,
  type AuthUser,
} from './auth.middleware.js';

// Routes
export { authRoutes } from './auth.routes.js';
