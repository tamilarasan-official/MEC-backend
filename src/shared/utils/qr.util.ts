/**
 * QR Code Utilities
 * Helper functions for generating and verifying QR code data
 */

import { createHash } from 'crypto';
import { QrCodeData } from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

const QR_SECRET = process.env['QR_SECRET'] ?? 'mec-food-app-qr-secret-key';
const QR_VERSION = '1';

// ============================================
// CHECKSUM GENERATION
// ============================================

/**
 * Generate a simple hash checksum for QR data
 * Uses SHA-256 and takes first 8 characters
 */
function generateChecksum(data: {
  orderId: string;
  pickupToken: string;
  shopId: string;
  timestamp: number;
}): string {
  const payload = `${data.orderId}:${data.pickupToken}:${data.shopId}:${data.timestamp}:${QR_SECRET}`;
  const hash = createHash('sha256').update(payload).digest('hex');
  return hash.substring(0, 8);
}

// ============================================
// QR DATA GENERATION
// ============================================

/**
 * Order data interface for QR generation
 */
export interface OrderForQr {
  _id: string | { toString(): string };
  pickupToken: string;
  shop: string | { _id: string | { toString(): string } };
}

/**
 * Generate QR data object from order
 * @param order - Order object with _id, pickupToken, and shop
 * @returns QR code data object
 */
export function generateQrData(order: OrderForQr): QrCodeData {
  const orderId = typeof order._id === 'string' ? order._id : order._id.toString();
  const pickupToken = order.pickupToken;
  const shopId = typeof order.shop === 'string'
    ? order.shop
    : typeof order.shop._id === 'string'
      ? order.shop._id
      : order.shop._id.toString();
  const timestamp = Date.now();

  const checksum = generateChecksum({ orderId, pickupToken, shopId, timestamp });

  return {
    orderId,
    pickupToken,
    shopId,
    checksum,
    timestamp,
  };
}

/**
 * Generate QR data from individual components
 */
export function createQrData(
  orderId: string,
  pickupToken: string,
  shopId: string
): QrCodeData {
  const timestamp = Date.now();
  const checksum = generateChecksum({ orderId, pickupToken, shopId, timestamp });

  return {
    orderId,
    pickupToken,
    shopId,
    checksum,
    timestamp,
  };
}

// ============================================
// ENCODING / DECODING
// ============================================

/**
 * Encode QR data to Base64 string
 * @param data - QR code data object
 * @returns Base64 encoded string
 */
export function encodeQrData(data: QrCodeData): string {
  const payload = {
    v: QR_VERSION,
    ...data,
  };
  const jsonString = JSON.stringify(payload);
  return Buffer.from(jsonString).toString('base64');
}

/**
 * Decode Base64 string to QR data
 * @param encoded - Base64 encoded string
 * @returns Decoded QR data or null if invalid
 */
export function decodeQrData(encoded: string): QrCodeData | null {
  try {
    const jsonString = Buffer.from(encoded, 'base64').toString('utf-8');
    const data = JSON.parse(jsonString);

    // Validate required fields
    if (
      !data.orderId ||
      !data.pickupToken ||
      !data.shopId ||
      !data.checksum ||
      !data.timestamp
    ) {
      return null;
    }

    return {
      orderId: data.orderId,
      pickupToken: data.pickupToken,
      shopId: data.shopId,
      checksum: data.checksum,
      timestamp: data.timestamp,
    };
  } catch {
    return null;
  }
}

// ============================================
// VERIFICATION
// ============================================

/**
 * Verify QR checksum integrity
 * @param data - QR code data to verify
 * @returns True if checksum is valid
 */
export function verifyQrChecksum(data: QrCodeData): boolean {
  const expectedChecksum = generateChecksum({
    orderId: data.orderId,
    pickupToken: data.pickupToken,
    shopId: data.shopId,
    timestamp: data.timestamp,
  });

  return data.checksum === expectedChecksum;
}

/**
 * Verify QR data with expiration check
 * @param data - QR code data
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns Verification result with reason
 */
export function verifyQrDataWithExpiry(
  data: QrCodeData,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): { valid: boolean; reason?: string } {
  // Check checksum
  if (!verifyQrChecksum(data)) {
    return { valid: false, reason: 'Invalid checksum' };
  }

  // Check expiration
  const age = Date.now() - data.timestamp;
  if (age > maxAgeMs) {
    return { valid: false, reason: 'QR code has expired' };
  }

  // Check if timestamp is in the future (clock skew tolerance: 5 minutes)
  if (data.timestamp > Date.now() + 5 * 60 * 1000) {
    return { valid: false, reason: 'Invalid timestamp' };
  }

  return { valid: true };
}

/**
 * Full QR verification including order matching
 */
export function verifyQrForOrder(
  qrData: QrCodeData,
  orderId: string,
  pickupToken: string,
  shopId: string
): { valid: boolean; reason?: string } {
  // Verify checksum and expiry first
  const checksumResult = verifyQrDataWithExpiry(qrData);
  if (!checksumResult.valid) {
    return checksumResult;
  }

  // Match order ID
  if (qrData.orderId !== orderId) {
    return { valid: false, reason: 'Order ID mismatch' };
  }

  // Match pickup token
  if (qrData.pickupToken !== pickupToken) {
    return { valid: false, reason: 'Pickup token mismatch' };
  }

  // Match shop ID
  if (qrData.shopId !== shopId) {
    return { valid: false, reason: 'Shop ID mismatch' };
  }

  return { valid: true };
}

// ============================================
// URL GENERATION
// ============================================

/**
 * Generate QR code URL (for use with QR code generation services)
 * @param data - QR code data
 * @param baseUrl - Base URL for the QR code content
 * @returns URL string for QR code content
 */
export function generateQrUrl(data: QrCodeData, baseUrl: string): string {
  const encoded = encodeQrData(data);
  return `${baseUrl}/pickup/verify?code=${encodeURIComponent(encoded)}`;
}

/**
 * Generate deep link URL for mobile app
 */
export function generateQrDeepLink(data: QrCodeData, appScheme: string = 'mecfood'): string {
  const encoded = encodeQrData(data);
  return `${appScheme}://pickup/verify?code=${encodeURIComponent(encoded)}`;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse QR code from scanned text
 * Handles both raw Base64 and URL formats
 */
export function parseScannedQr(scannedText: string): QrCodeData | null {
  // Try to extract from URL if it's a URL
  if (scannedText.includes('?code=')) {
    const match = scannedText.match(/[?&]code=([^&]+)/);
    if (match) {
      const encoded = decodeURIComponent(match[1]);
      return decodeQrData(encoded);
    }
  }

  // Try direct Base64 decode
  return decodeQrData(scannedText);
}

/**
 * Create a minimal QR payload for smaller QR codes
 * Uses shorter field names
 */
export function createMinimalQrPayload(data: QrCodeData): string {
  const minimal = {
    o: data.orderId,
    p: data.pickupToken,
    s: data.shopId,
    c: data.checksum,
    t: data.timestamp,
  };
  return Buffer.from(JSON.stringify(minimal)).toString('base64');
}

/**
 * Parse minimal QR payload
 */
export function parseMinimalQrPayload(encoded: string): QrCodeData | null {
  try {
    const jsonString = Buffer.from(encoded, 'base64').toString('utf-8');
    const data = JSON.parse(jsonString);

    if (!data.o || !data.p || !data.s || !data.c || !data.t) {
      return null;
    }

    return {
      orderId: data.o,
      pickupToken: data.p,
      shopId: data.s,
      checksum: data.c,
      timestamp: data.t,
    };
  } catch {
    return null;
  }
}
