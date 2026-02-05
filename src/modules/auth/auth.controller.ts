/**
 * Authentication Controller
 * Request handlers for authentication endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service.js';
import { RegisterInput, LoginInput, RefreshTokenInput, ChangePasswordInput } from './auth.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

// Cookie configuration
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Set refresh token as httpOnly cookie
 */
function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/api/v1/auth', // Only send to auth endpoints
  });
}

/**
 * Clear refresh token cookie
 */
function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/v1/auth',
  });
}

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
 * Returns access token and user data
 * Refresh token is set as httpOnly cookie for security
 */
export async function login(
  req: TypedRequest<LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          // Also return refresh token in response for backward compatibility
          // Frontend should migrate to using httpOnly cookies
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
 * Accepts refresh token from httpOnly cookie OR request body (backward compat)
 * Returns new access token and sets new refresh token cookie
 */
export async function refresh(
  req: TypedRequest<RefreshTokenInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try to get refresh token from cookie first, then from body
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body.refreshToken;

    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const tokens = await authService.refreshToken(refreshToken);

    // Set new refresh token as httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          // Also return refresh token for backward compatibility
          refreshToken: tokens.refreshToken,
          expiresIn: '15m',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Clear invalid cookie on error
    clearRefreshTokenCookie(res);

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
 * Clears the httpOnly refresh token cookie
 * Note: JWT tokens are stateless, so this is mostly for client-side cleanup
 * In a production system, you might want to add the token to a blacklist
 */
export async function logout(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  // Clear the refresh token cookie
  clearRefreshTokenCookie(res);

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

/**
 * PUT /auth/change-password
 * Change current user's password
 */
export async function changePassword(
  req: TypedRequest<ChangePasswordInput>,
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

    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(userId, currentPassword, newPassword);

    logger.info(`Password changed for user: ${userId}`);

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        message: 'Password changed successfully',
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

    logger.error('Change password error:', error);
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
  changePassword,
};

export default authController;
