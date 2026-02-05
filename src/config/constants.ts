/**
 * Application Constants
 * Central location for all app-wide constant values
 */

// User Roles
export const UserRole = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  DELIVERY: 'delivery',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

// Order Statuses
export const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

// Order status flow for validation
export const OrderStatusFlow: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

// Transaction Types
export const TransactionType = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  REFUND: 'refund',
  WITHDRAWAL: 'withdrawal',
  DEPOSIT: 'deposit',
  ORDER_PAYMENT: 'order_payment',
  VENDOR_PAYOUT: 'vendor_payout',
  DELIVERY_PAYOUT: 'delivery_payout',
} as const;

export type TransactionTypeValue = (typeof TransactionType)[keyof typeof TransactionType];

// Transaction Statuses
export const TransactionStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatusType = (typeof TransactionStatus)[keyof typeof TransactionStatus];

// Payment Methods
export const PaymentMethod = {
  WALLET: 'wallet',
  UPI: 'upi',
  CARD: 'card',
  NET_BANKING: 'net_banking',
  CASH_ON_DELIVERY: 'cash_on_delivery',
} as const;

export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// JWT Configuration
export const JwtConfig = {
  ACCESS_TOKEN_EXPIRY: process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '15m',
  REFRESH_TOKEN_EXPIRY: process.env['JWT_REFRESH_TOKEN_EXPIRY'] ?? '7d',
  ISSUER: process.env['JWT_ISSUER'] ?? 'mecfoodapp',
  AUDIENCE: process.env['JWT_AUDIENCE'] ?? 'mecfoodapp-users',
};

// Rate Limiting Configuration
export const RateLimitConfig = {
  // General API rate limit
  GENERAL: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? '100', 10),
  },
  // Auth endpoints (more strict)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  },
  // Password reset (very strict)
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  // OTP requests
  OTP: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 5,
  },
} as const;

// Pagination Defaults
export const PaginationConfig = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// File Upload Limits
export const FileUploadConfig = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

// Vendor Configuration
export const VendorConfig = {
  MIN_ORDER_AMOUNT: 50,
  MAX_PREPARATION_TIME: 120, // minutes
  DEFAULT_COMMISSION_RATE: 15, // percentage
} as const;

// Delivery Configuration
export const DeliveryConfig = {
  BASE_DELIVERY_FEE: 30,
  PER_KM_CHARGE: 5,
  FREE_DELIVERY_THRESHOLD: 500,
  MAX_DELIVERY_RADIUS: 10, // km
} as const;

// Socket.IO Events
export const SocketEvents = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  ORDER_CANCELLED: 'order:cancelled',

  // Delivery events
  DELIVERY_LOCATION_UPDATE: 'delivery:location_update',
  DELIVERY_ASSIGNED: 'delivery:assigned',
  DELIVERY_STARTED: 'delivery:started',
  DELIVERY_COMPLETED: 'delivery:completed',

  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',

  // Notification events
  NOTIFICATION: 'notification',
} as const;

// HTTP Status Codes
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Messages
export const ErrorMessages = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid token',
} as const;

export default {
  UserRole,
  OrderStatus,
  OrderStatusFlow,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  JwtConfig,
  RateLimitConfig,
  PaginationConfig,
  FileUploadConfig,
  VendorConfig,
  DeliveryConfig,
  SocketEvents,
  HttpStatus,
  ErrorMessages,
};
