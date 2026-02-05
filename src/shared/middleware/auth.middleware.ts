/**
 * Authentication Middleware
 * Handles JWT verification and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware.js';
import { AuthUser, JwtPayload, UserRole } from '../types/index.js';
import { HttpStatus } from '../../config/constants.js';

// ============================================
// JWT CONFIGURATION
// ============================================

// Get and validate JWT secret
function getJwtSecret(): string {
  const secret = process.env['JWT_ACCESS_SECRET'] || process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET or JWT_ACCESS_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const JWT_ISSUER = process.env['JWT_ISSUER'] || 'mecfoodapp';
const JWT_AUDIENCE = process.env['JWT_AUDIENCE'] || 'mecfoodapp-users';

// ============================================
// TOKEN EXTRACTION
// ============================================

/**
 * Extract JWT token from request
 * Supports: Authorization header (Bearer token), cookies, query param
 */
function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  if (req.cookies && req.cookies['accessToken']) {
    return req.cookies['accessToken'] as string;
  }

  // Try query parameter (for WebSocket connections)
  if (req.query && req.query['token']) {
    return req.query['token'] as string;
  }

  return null;
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    // Check error by name since ES module imports may not work with instanceof
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw AppError.unauthorized('Invalid token');
      }
    }
    throw AppError.unauthorized('Token verification failed');
  }
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Middleware to authenticate user
 * Requires valid JWT token
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    return next(AppError.unauthorized('Authentication token required'));
  }

  try {
    const decoded = verifyToken(token);

    // Attach user info to request
    const authUser: AuthUser = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      shopId: decoded.shopId,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to optionally authenticate user
 * Continues even without token, but attaches user if token is valid
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);

    const authUser: AuthUser = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      shopId: decoded.shopId,
    };

    req.user = authUser;
  } catch {
    // Ignore errors for optional auth
  }

  next();
}

/**
 * Middleware to require authentication and specific roles
 * Combines authenticate with role checking
 * Accepts both new app roles (student, captain, owner, accountant, superadmin)
 * and legacy roles (admin, super_admin) for backwards compatibility
 */
export function requireAuth(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    authenticate(req, res, (err?: unknown) => {
      if (err) {
        return next(err);
      }

      // If roles specified, check if user has required role
      if (roles.length > 0 && req.user) {
        const userRole = (req.user.role as string).toLowerCase();

        // Normalize user role (map legacy roles to new roles)
        let normalizedUserRole = userRole;
        if (userRole === 'admin') normalizedUserRole = 'accountant';
        if (userRole === 'super_admin') normalizedUserRole = 'superadmin';
        if (userRole === 'canteen') normalizedUserRole = 'captain';

        // Map legacy roles to new roles for compatibility in required roles (case-insensitive)
        const normalizedRoles = roles.map(role => {
          const lowerRole = role.toLowerCase();
          if (lowerRole === 'admin') return 'accountant';
          if (lowerRole === 'super_admin') return 'superadmin';
          if (lowerRole === 'canteen') return 'captain';
          return lowerRole;
        });

        const roleMatch = normalizedRoles.includes(normalizedUserRole);

        if (!roleMatch) {
          return next(
            new AppError(
              'Access denied. Insufficient permissions for this resource.',
              HttpStatus.FORBIDDEN,
              'INSUFFICIENT_ROLE',
              true
            )
          );
        }
      }

      next();
    });
  };
}

/**
 * Utility function to generate JWT token
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string | number = '15m'): string {
  return jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    subject: payload.sub,
  });
}

/**
 * Utility function to generate refresh token
 */
export function generateRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign(
    { sub: userId, tokenId },
    JWT_SECRET,
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: '7d' as jwt.SignOptions['expiresIn'],
    }
  );
}

export default {
  authenticate,
  optionalAuthenticate,
  requireAuth,
  generateToken,
  generateRefreshToken,
};
