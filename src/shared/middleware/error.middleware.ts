/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

import { Request, Response, NextFunction } from 'express';
import { HttpStatus, ErrorMessages } from '../../config/constants.js';
import { ErrorResponse } from '../types/index.js';

// ============================================
// APP ERROR CLASS
// ============================================

/**
 * Custom application error with status code and operational flag
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown> | unknown[];

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown> | unknown[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message: string, code: string = 'BAD_REQUEST', details?: Record<string, unknown>): AppError {
    return new AppError(message, 400, code, true, details);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message: string = 'Authentication required', code: string = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, code, true);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message: string = 'Access denied', code: string = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, code, true);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(message: string = 'Resource not found', code: string = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, code, true);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(message: string, code: string = 'CONFLICT'): AppError {
    return new AppError(message, 409, code, true);
  }

  /**
   * Create a 422 Validation error
   */
  static validation(message: string = 'Validation failed', details?: unknown[]): AppError {
    return new AppError(message, 422, 'VALIDATION_ERROR', true, details);
  }

  /**
   * Create a 429 Rate Limit error
   */
  static rateLimit(message: string = 'Too many requests, please try again later'): AppError {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }

  /**
   * Create a 500 Internal Server error
   */
  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR', false);
  }
}

// ============================================
// ERROR FORMATTING HELPERS
// ============================================

/**
 * Format error response consistently
 */
function formatErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown> | unknown[],
  stack?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  if (requestId) {
    response.requestId = requestId;
  }

  if (details) {
    response.error.details = details;
  }

  // Only include stack trace in development
  if (stack && process.env['NODE_ENV'] === 'development') {
    response.error.stack = stack;
  }

  return response;
}

// ============================================
// MONGOOSE ERROR HANDLERS
// ============================================

interface MongooseValidationError extends Error {
  errors: Record<string, { message: string; path: string; kind: string }>;
}

interface MongooseCastError extends Error {
  path: string;
  value: unknown;
  kind: string;
}

interface MongooseDuplicateKeyError extends Error {
  code: number;
  keyValue: Record<string, unknown>;
}

/**
 * Handle Mongoose validation errors
 */
function handleMongooseValidationError(err: MongooseValidationError): AppError {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
    kind: e.kind,
  }));

  return new AppError(
    'Validation failed',
    HttpStatus.UNPROCESSABLE_ENTITY,
    'VALIDATION_ERROR',
    true,
    errors
  );
}

/**
 * Handle Mongoose cast errors (invalid ObjectId, etc.)
 */
function handleMongooseCastError(err: MongooseCastError): AppError {
  return new AppError(
    `Invalid ${err.path}: ${err.value}`,
    HttpStatus.BAD_REQUEST,
    'INVALID_ID',
    true
  );
}

/**
 * Handle MongoDB duplicate key errors
 * Note: We don't expose the actual value to prevent information leakage
 */
function handleDuplicateKeyError(err: MongooseDuplicateKeyError): AppError {
  const field = Object.keys(err.keyValue)[0];
  // Don't expose the actual value in the error message (security)
  // Only expose the field name so the user knows what needs to be unique

  return new AppError(
    `A record with this ${field} already exists`,
    HttpStatus.CONFLICT,
    'DUPLICATE_KEY',
    true,
    { field } // Don't include actual value
  );
}

// ============================================
// JWT ERROR HANDLERS
// ============================================

interface JwtError extends Error {
  name: string;
  expiredAt?: Date;
}

/**
 * Handle JWT errors
 */
function handleJwtError(err: JwtError): AppError {
  if (err.name === 'TokenExpiredError') {
    return new AppError(
      ErrorMessages.TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
      'TOKEN_EXPIRED',
      true
    );
  }

  if (err.name === 'JsonWebTokenError') {
    return new AppError(
      ErrorMessages.INVALID_TOKEN,
      HttpStatus.UNAUTHORIZED,
      'INVALID_TOKEN',
      true
    );
  }

  if (err.name === 'NotBeforeError') {
    return new AppError(
      'Token not yet valid',
      HttpStatus.UNAUTHORIZED,
      'TOKEN_NOT_VALID_YET',
      true
    );
  }

  return AppError.unauthorized();
}

// ============================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// ============================================

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default values
  let statusCode: number = 500;
  let code: string = 'INTERNAL_ERROR';
  let message: string = 'Internal server error';
  let details: Record<string, unknown> | unknown[] | undefined;
  let isOperational = false;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    isOperational = err.isOperational;
  }
  // Handle Mongoose validation errors
  else if (err.name === 'ValidationError') {
    const appError = handleMongooseValidationError(err as MongooseValidationError);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
    details = appError.details;
    isOperational = true;
  }
  // Handle Mongoose cast errors
  else if (err.name === 'CastError') {
    const appError = handleMongooseCastError(err as MongooseCastError);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
    isOperational = true;
  }
  // Handle MongoDB duplicate key errors
  else if ((err as MongooseDuplicateKeyError).code === 11000) {
    const appError = handleDuplicateKeyError(err as MongooseDuplicateKeyError);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
    details = appError.details;
    isOperational = true;
  }
  // Handle JWT errors
  else if (
    err.name === 'TokenExpiredError' ||
    err.name === 'JsonWebTokenError' ||
    err.name === 'NotBeforeError'
  ) {
    const appError = handleJwtError(err as JwtError);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
    isOperational = true;
  }
  // Handle syntax errors (malformed JSON)
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
    isOperational = true;
  }

  // Log error for non-operational errors
  if (!isOperational) {
    console.error('[ERROR]', {
      code,
      message: err.message,
      stack: err.stack,
      requestId: req.requestId,
      path: req.path,
      method: req.method,
    });
  }

  // Format and send response
  const errorResponse = formatErrorResponse(
    statusCode,
    code,
    message,
    req.requestId,
    details,
    err.stack
  );

  res.status(statusCode).json(errorResponse);
}

// ============================================
// NOT FOUND HANDLER
// ============================================

/**
 * Handle 404 for undefined routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// ============================================
// ASYNC HANDLER WRAPPER
// ============================================

/**
 * Wrapper for async route handlers to catch errors
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
