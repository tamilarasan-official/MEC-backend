/**
 * Authentication Middleware
 * Middleware functions for protecting routes and extracting user info
 */

import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';
import { UserRole } from '../users/user.model.js';

// ============================================
// TYPES
// ============================================

/**
 * User info attached to authenticated requests
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  shopId?: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Authentication middleware
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches user info to request object
 *
 * Usage: router.get('/protected', authenticate, handler)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication required. Please provide a valid access token.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify token and extract payload
    const payload = authService.verifyAccessToken(token);

    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      shopId: payload.shopId,
    };

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.error('Authentication middleware error:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Optional authentication middleware
 * Same as authenticate, but doesn't fail if no token is provided
 * Useful for endpoints that work differently for authenticated vs anonymous users
 *
 * Usage: router.get('/products', optionalAuth, handler)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      // No token provided, continue without user
      next();
      return;
    }

    // Verify token and extract payload
    const payload = authService.verifyAccessToken(token);

    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      shopId: payload.shopId,
    };

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    // Just log the error and continue without user
    if (error instanceof AuthError) {
      logger.debug(`Optional auth failed: ${error.message}`);
    } else {
      logger.warn('Optional auth error:', error);
    }

    next();
  }
}

/**
 * Role-based authorization middleware factory
 * Checks if the authenticated user has one of the allowed roles
 *
 * Usage: router.get('/admin', authenticate, authorize('admin', 'superadmin'), handler)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Shop access middleware
 * Verifies that the user has access to the specified shop
 * For captain/owner/accountant users, checks if they belong to the shop
 *
 * Usage: router.get('/shops/:shopId/orders', authenticate, shopAccess, handler)
 */
export function shopAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Superadmin has access to all shops
  if (req.user.role === 'superadmin') {
    next();
    return;
  }

  // Get shop ID from params or body
  const shopId = req.params['shopId'] ?? req.body?.shopId;

  if (!shopId) {
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'MISSING_SHOP_ID',
        message: 'Shop ID is required',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Staff members can only access their assigned shop
  if (['captain', 'owner', 'accountant'].includes(req.user.role)) {
    if (req.user.shopId !== shopId) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        error: {
          code: 'SHOP_ACCESS_DENIED',
          message: 'You do not have access to this shop',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  next();
}

// ============================================
// EXPORTS
// ============================================

export const authMiddleware = {
  authenticate,
  optionalAuth,
  authorize,
  shopAccess,
};

export default authMiddleware;
