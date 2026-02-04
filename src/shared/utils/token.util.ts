/**
 * Token Utilities
 * Helper functions for generating various tokens and identifiers
 */

import { randomBytes, randomUUID } from 'crypto';

// ============================================
// ORDER NUMBER GENERATION
// ============================================

/**
 * Counter for order numbers within the same millisecond
 */
let orderCounter = 0;
let lastOrderTimestamp = 0;

/**
 * Generate order number in format: ORD-YYYYMMDD-XXXX
 * Uses date and a sequential 4-digit number
 * @returns Formatted order number
 */
export function generateOrderNumber(): string {
  const now = new Date();

  // Format date as YYYYMMDD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Get current timestamp for same-day ordering
  const currentTimestamp = now.getTime();

  // Reset counter if it's a new day or counter overflow
  if (
    Math.floor(lastOrderTimestamp / 86400000) !== Math.floor(currentTimestamp / 86400000) ||
    orderCounter >= 9999
  ) {
    orderCounter = 0;
  }

  lastOrderTimestamp = currentTimestamp;
  orderCounter++;

  // Format counter as 4-digit number
  const counterStr = String(orderCounter).padStart(4, '0');

  return `ORD-${dateStr}-${counterStr}`;
}

/**
 * Generate order number with random suffix for high-concurrency scenarios
 */
export function generateUniqueOrderNumber(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Generate random 6-character alphanumeric suffix
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();

  return `ORD-${dateStr}-${randomSuffix}`;
}

/**
 * Parse order number to extract date
 */
export function parseOrderNumber(orderNumber: string): {
  valid: boolean;
  date?: Date;
  sequence?: string;
} {
  const match = orderNumber.match(/^ORD-(\d{4})(\d{2})(\d{2})-(\w+)$/);

  if (!match) {
    return { valid: false };
  }

  const [, year, month, day, sequence] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10)
  );

  return { valid: true, date, sequence };
}

// ============================================
// PICKUP TOKEN GENERATION
// ============================================

/**
 * Generate a random 4-digit pickup token
 * Used for order verification at pickup
 * @returns 4-digit string
 */
export function generatePickupToken(): string {
  // Generate a random number between 1000 and 9999
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return String(randomNum);
}

/**
 * Generate a 6-character alphanumeric pickup token
 * More secure than numeric-only
 */
export function generateAlphanumericPickupToken(): string {
  // Characters that are easy to read (excluding confusing ones like 0/O, 1/I/l)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    token += chars[randomIndex];
  }

  return token;
}

/**
 * Generate pickup token with checksum
 * Last digit is a checksum for validation
 */
export function generatePickupTokenWithChecksum(): string {
  // Generate first 3 digits
  const base = Math.floor(Math.random() * 900) + 100;

  // Calculate checksum (sum of digits mod 10)
  const digits = String(base).split('').map(Number);
  const checksum = digits.reduce((a, b) => a + b, 0) % 10;

  return `${base}${checksum}`;
}

/**
 * Verify pickup token checksum
 */
export function verifyPickupTokenChecksum(token: string): boolean {
  if (!/^\d{4}$/.test(token)) {
    return false;
  }

  const digits = token.split('').map(Number);
  const baseSum = digits[0] + digits[1] + digits[2];
  const expectedChecksum = baseSum % 10;

  return digits[3] === expectedChecksum;
}

// ============================================
// REQUEST ID GENERATION
// ============================================

/**
 * Generate a UUID for request tracking
 * @returns UUID v4 string
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Generate a shorter request ID
 * 12 characters, suitable for logging
 */
export function generateShortRequestId(): string {
  return randomBytes(6).toString('hex');
}

/**
 * Generate a prefixed request ID
 */
export function generatePrefixedRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================
// SESSION TOKENS
// ============================================

/**
 * Generate a secure session token
 * 32 bytes = 64 hex characters
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a secure refresh token
 * 48 bytes = 96 hex characters
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

// ============================================
// VERIFICATION CODES
// ============================================

/**
 * Generate OTP (One-Time Password)
 * @param length - Length of OTP (default: 6)
 * @returns Numeric OTP string
 */
export function generateOTP(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(otp);
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

// ============================================
// API KEYS
// ============================================

/**
 * Generate API key
 * Format: prefix_randomBytes
 */
export function generateApiKey(prefix: string = 'mec'): string {
  const key = randomBytes(24).toString('base64url');
  return `${prefix}_${key}`;
}

/**
 * Generate API secret
 */
export function generateApiSecret(): string {
  return randomBytes(32).toString('base64url');
}

// ============================================
// UNIQUE IDENTIFIERS
// ============================================

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  return `TXN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate a unique invoice number
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `INV-${year}${month}-${random}`;
}

/**
 * Generate a shop code
 * Format: SHP-XXXXX (5 alphanumeric)
 */
export function generateShopCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return `SHP-${code}`;
}

/**
 * Generate a user reference code
 */
export function generateUserRefCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}
