/**
 * Shared TypeScript Types and Interfaces
 * Central location for all shared type definitions
 */

import { Request } from 'express';

// ============================================
// USER TYPES
// ============================================

// User roles matching the user model
export type UserRole = 'student' | 'captain' | 'owner' | 'accountant' | 'superadmin';

// ============================================
// ORDER TYPES
// ============================================

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionType =
  | 'credit'
  | 'debit'
  | 'refund'
  | 'withdrawal'
  | 'deposit'
  | 'order_payment'
  | 'vendor_payout'
  | 'delivery_payout';

export type TransactionSource =
  | 'wallet'
  | 'upi'
  | 'card'
  | 'net_banking'
  | 'cash_on_delivery'
  | 'bank_transfer'
  | 'system';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginated response with data and pagination info
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | unknown[];
    stack?: string;
  };
  requestId?: string;
  timestamp: string;
}

// ============================================
// JWT TYPES
// ============================================

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  shopId?: string; // For vendor/captain users
  iat?: number;
  exp?: number;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

// ============================================
// EXPRESS EXTENSION
// ============================================

/**
 * Authenticated user info attached to request
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  shopId?: string;
}

/**
 * Extended Express Request with user authentication
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  requestId?: string;
}

// Declaration merging to extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

// ============================================
// PERMISSION TYPES
// ============================================

export type Permission =
  // User permissions
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  | 'user:manage'
  // Order permissions
  | 'order:read'
  | 'order:write'
  | 'order:cancel'
  | 'order:manage'
  // Shop permissions
  | 'shop:read'
  | 'shop:write'
  | 'shop:delete'
  | 'shop:manage'
  // Menu permissions
  | 'menu:read'
  | 'menu:write'
  | 'menu:delete'
  // Wallet permissions
  | 'wallet:read'
  | 'wallet:write'
  | 'wallet:manage'
  // Admin permissions
  | 'admin:read'
  | 'admin:write'
  | 'admin:manage'
  // System permissions
  | 'system:config'
  | 'system:logs';

// ============================================
// QR CODE TYPES
// ============================================

export interface QrCodeData {
  orderId: string;
  pickupToken: string;
  shopId: string;
  checksum: string;
  timestamp: number;
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// ============================================
// PAGINATION INPUT TYPES
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
}
