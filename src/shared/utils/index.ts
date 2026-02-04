/**
 * Utils Index
 * Re-exports all utilities for convenient importing
 */

// Response utilities
export {
  successResponse,
  successMessage,
  createdResponse,
  noContentResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  paginatedResponse,
  createPaginatedResponse,
  withRequestId,
  withMeta,
  listResponse,
} from './response.util.js';

// Pagination utilities
export {
  parsePaginationParams,
  parsePaginationWithDefaults,
  createPaginationMeta,
  createExtendedPaginationMeta,
  getAggregationPaginationStages,
  getPaginationFacet,
  parseFacetResult,
  parseCursorPaginationParams,
  createCursorPaginationMeta,
  decodeCursor,
  encodeCursor,
  normalizePaginationParams,
  getPaginationDefaults,
} from './pagination.util.js';

export type { CursorPaginationParams, CursorPaginationMeta } from './pagination.util.js';

// QR code utilities
export {
  generateQrData,
  createQrData,
  encodeQrData,
  decodeQrData,
  verifyQrChecksum,
  verifyQrDataWithExpiry,
  verifyQrForOrder,
  generateQrUrl,
  generateQrDeepLink,
  parseScannedQr,
  createMinimalQrPayload,
  parseMinimalQrPayload,
} from './qr.util.js';

export type { OrderForQr } from './qr.util.js';

// Token utilities
export {
  generateOrderNumber,
  generateUniqueOrderNumber,
  parseOrderNumber,
  generatePickupToken,
  generateAlphanumericPickupToken,
  generatePickupTokenWithChecksum,
  verifyPickupTokenChecksum,
  generateRequestId,
  generateShortRequestId,
  generatePrefixedRequestId,
  generateSessionToken,
  generateRefreshToken as generateRefreshTokenString,
  generateOTP,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateApiKey,
  generateApiSecret,
  generateTransactionId,
  generateInvoiceNumber,
  generateShopCode,
  generateUserRefCode,
} from './token.util.js';

// Storage utilities (Garage S3)
export {
  uploadFile,
  uploadBase64Image,
  deleteFile,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  getPublicUrl,
  isStorageConfigured,
  StorageFolders,
} from './storage.util.js';

export type { UploadResult, StorageFolder } from './storage.util.js';
