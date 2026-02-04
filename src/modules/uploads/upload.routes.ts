/**
 * Upload Routes
 * API routes for file upload operations
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import {
  getStorageStatus,
  uploadImage,
  getPresignedUploadUrl,
  deleteUploadedFile,
} from './upload.controller.js';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   GET /api/v1/uploads/status
 * @desc    Check if storage is configured
 * @access  Public
 */
router.get('/status', getStorageStatus);

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * @route   POST /api/v1/uploads/image
 * @desc    Upload a base64 encoded image
 * @access  Protected (captain, owner, superadmin)
 * @body    { image: string, filename: string, folder?: string }
 */
router.post(
  '/image',
  requireAuth('captain', 'owner', 'superadmin', 'accountant'),
  uploadImage
);

/**
 * @route   POST /api/v1/uploads/presigned
 * @desc    Get a presigned URL for direct upload
 * @access  Protected (captain, owner, superadmin)
 * @body    { filename: string, folder?: string }
 */
router.post(
  '/presigned',
  requireAuth('captain', 'owner', 'superadmin', 'accountant'),
  getPresignedUploadUrl
);

/**
 * @route   DELETE /api/v1/uploads/:key
 * @desc    Delete an uploaded file
 * @access  Protected (captain, owner, superadmin)
 * @param   key - The file key (URL encoded)
 */
router.delete(
  '/:key(*)',
  requireAuth('captain', 'owner', 'superadmin'),
  deleteUploadedFile
);

export default router;
