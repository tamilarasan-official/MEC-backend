/**
 * Response Utilities
 * Helper functions for formatting API responses
 */

import { ApiResponse, PaginatedResponse, PaginationMeta, ErrorResponse } from '../types/index.js';

// ============================================
// SUCCESS RESPONSE
// ============================================

/**
 * Format a successful API response
 * @param data - Response data
 * @param meta - Optional metadata
 * @param message - Optional success message
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  message?: string
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
}

/**
 * Format a success response with a message
 */
export function successMessage(message: string, data?: unknown): ApiResponse<unknown> {
  return {
    success: true,
    data: data ?? null,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a created response (201)
 */
export function createdResponse<T>(
  data: T,
  message: string = 'Resource created successfully'
): ApiResponse<T> {
  return successResponse(data, undefined, message);
}

/**
 * Format a no content response (204)
 */
export function noContentResponse(): { success: true } {
  return { success: true };
}

// ============================================
// ERROR RESPONSE
// ============================================

/**
 * Format an error API response
 * @param code - Error code
 * @param message - Error message
 * @param details - Optional error details
 * @param requestId - Optional request ID for tracking
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown> | unknown[],
  requestId?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.error.details = details;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}

/**
 * Format a validation error response
 */
export function validationErrorResponse(
  errors: Array<{ field: string; message: string }>,
  requestId?: string
): ErrorResponse {
  return errorResponse(
    'VALIDATION_ERROR',
    'Validation failed',
    errors,
    requestId
  );
}

/**
 * Format a not found error response
 */
export function notFoundResponse(
  resource: string = 'Resource',
  requestId?: string
): ErrorResponse {
  return errorResponse(
    'NOT_FOUND',
    `${resource} not found`,
    undefined,
    requestId
  );
}

/**
 * Format an unauthorized error response
 */
export function unauthorizedResponse(
  message: string = 'Authentication required',
  requestId?: string
): ErrorResponse {
  return errorResponse(
    'UNAUTHORIZED',
    message,
    undefined,
    requestId
  );
}

/**
 * Format a forbidden error response
 */
export function forbiddenResponse(
  message: string = 'Access denied',
  requestId?: string
): ErrorResponse {
  return errorResponse(
    'FORBIDDEN',
    message,
    undefined,
    requestId
  );
}

// ============================================
// PAGINATED RESPONSE
// ============================================

/**
 * Format a paginated API response
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param meta - Optional additional metadata
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Record<string, unknown>
): PaginatedResponse<T> {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return response;
}

/**
 * Create pagination metadata and format paginated response
 * Convenience wrapper that combines pagination creation with response formatting
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  meta?: Record<string, unknown>
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  const pagination: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  return paginatedResponse(data, pagination, meta);
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Add request ID to any response
 */
export function withRequestId<T extends { requestId?: string }>(
  response: T,
  requestId: string
): T {
  return {
    ...response,
    requestId,
  };
}

/**
 * Create a response with additional metadata
 */
export function withMeta<T>(
  response: ApiResponse<T>,
  additionalMeta: Record<string, unknown>
): ApiResponse<T> {
  return {
    ...response,
    meta: {
      ...response.meta,
      ...additionalMeta,
    },
  };
}

/**
 * Create a response for a list/collection
 */
export function listResponse<T>(
  items: T[],
  total?: number,
  meta?: Record<string, unknown>
): ApiResponse<T[]> {
  return successResponse(
    items,
    {
      count: items.length,
      total: total ?? items.length,
      ...meta,
    }
  );
}
