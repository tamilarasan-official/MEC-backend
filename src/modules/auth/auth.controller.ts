/**
 * Authentication Controller
 * Request handlers for authentication endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service.js';
import { RegisterInput, LoginInput, RefreshTokenInput } from './auth.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TypedRequest<T> extends Request {
  body: T;
}

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

/**
 * POST /auth/register
 * Register a new student account (awaiting admin approval)
 */
export async function register(
  req: TypedRequest<RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.register(req.body);

    res.status(HttpStatus.CREATED).json({
      success: true,
      data: {
        user,
        message: 'Registration successful. Your account is pending admin approval.',
      },
      timestamp: new Date().toISOString(),
    });
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

    logger.error('Registration error:', error);
    next(error);
  }
}

/**
 * POST /auth/login
 * Login with username and password
 * Returns access token, refresh token, and user data
 */
export async function login(
  req: TypedRequest<LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: '15m',
        },
      },
      timestamp: new Date().toISOString(),
    });
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

    logger.error('Login error:', error);
    next(error);
  }
}

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Returns new access token and refresh token
 */
export async function refresh(
  req: TypedRequest<RefreshTokenInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: '15m',
        },
      },
      timestamp: new Date().toISOString(),
    });
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

    logger.error('Token refresh error:', error);
    next(error);
  }
}

/**
 * POST /auth/logout
 * Logout current user (invalidate session)
 * Note: JWT tokens are stateless, so this is mostly for client-side cleanup
 * In a production system, you might want to add the token to a blacklist
 */
export async function logout(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  // In a stateless JWT system, logout is handled client-side by removing tokens
  // For added security, you could implement a token blacklist in Redis

  const userId = req.user?.id;
  if (userId) {
    logger.info(`User logged out: ${userId}`);
  }

  res.status(HttpStatus.OK).json({
    success: true,
    data: {
      message: 'Logged out successfully',
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /auth/me
 * Get current authenticated user's information
 */
export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
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

    const user = await authService.getUserById(userId);

    if (!user) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        user,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    next(error);
  }
}

// ============================================
// EXPORTS
// ============================================

export const authController = {
  register,
  login,
  refresh,
  logout,
  me,
};

export default authController;
