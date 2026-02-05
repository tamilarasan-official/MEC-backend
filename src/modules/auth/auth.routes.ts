/**
 * Authentication Routes
 * Express router for authentication endpoints
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { validate, registerSchema, loginSchema, refreshTokenSchema, changePasswordSchema } from './auth.validation.js';
import { RateLimitConfig } from '../../config/constants.js';

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authRateLimiter = rateLimit({
  windowMs: RateLimitConfig.AUTH.windowMs, // 15 minutes
  max: RateLimitConfig.AUTH.maxRequests, // 10 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP address and username (if available) as key
    const ip = req.ip ?? 'unknown';
    const username = req.body?.username ?? '';
    return `${ip}:${username}`;
  },
});

/**
 * Rate limiter for registration
 * More strict to prevent spam registrations
 */
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again later.',
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// ROUTER SETUP
// ============================================

const router = Router();

/**
 * POST /auth/register
 * Register a new student account
 * Rate limited to prevent spam
 */
router.post(
  '/register',
  registerRateLimiter,
  validate(registerSchema),
  authController.register
);

/**
 * POST /auth/login
 * Login with username and password
 * Rate limited to prevent brute force attacks
 */
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refresh
);

/**
 * POST /auth/logout
 * Logout current user
 * Protected - requires authentication
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * GET /auth/me
 * Get current authenticated user's information
 * Protected - requires authentication
 */
router.get(
  '/me',
  authenticate,
  authController.me
);

/**
 * PUT /auth/change-password
 * Change current user's password
 * Protected - requires authentication
 */
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

// ============================================
// EXPORTS
// ============================================

export { router as authRoutes };
export default router;
