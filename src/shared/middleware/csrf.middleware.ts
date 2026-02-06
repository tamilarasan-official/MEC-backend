/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens for state-changing requests
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../../config/logger.js';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Methods that don't require CSRF validation (read-only)
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and set CSRF token in cookie
 * Should be applied early in the middleware chain
 */
export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction): void {
  // Only set CSRF cookie if not already present or expired
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();

    // Set as httpOnly: false so client-side JavaScript can read it
    // This is intentional - the security comes from the double-submit pattern
    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      domain: isProduction ? '.welocalhost.com' : undefined,
    });

    // Also attach to request for potential use in response
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies[CSRF_COOKIE_NAME];
  }

  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Uses double-submit cookie pattern: compares cookie value with header value
 */
export function csrfValidator(req: Request, res: Response, next: NextFunction): void {
  // Skip validation for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF for WebSocket upgrade requests
  if (req.headers.upgrade === 'websocket') {
    return next();
  }

  // Skip CSRF for auth endpoints (login, register, etc.) since user isn't authenticated yet
  // These endpoints have their own protection (rate limiting, account lockout)
  const authPaths = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh'];
  if (authPaths.some(path => req.path.endsWith(path))) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF validation failed: missing token', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF token validation failed',
      },
    });
    return;
  }

  // Tokens must match (constant-time comparison to prevent timing attacks)
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('CSRF validation failed: token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF token validation failed',
      },
    });
    return;
  }

  next();
}

/**
 * Combined CSRF middleware that generates and validates
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  csrfTokenGenerator(req, res, (err) => {
    if (err) return next(err);
    csrfValidator(req, res, next);
  });
}

// Extend Express Request type to include csrfToken
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

export default {
  csrfTokenGenerator,
  csrfValidator,
  csrfProtection,
};
