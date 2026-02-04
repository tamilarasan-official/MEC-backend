/**
 * Upload Controller
 * Handles file upload operations for menu images, shop logos, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { uploadFile, uploadBase64Image, deleteFile, getUploadPresignedUrl, isStorageConfigured, StorageFolders, type StorageFolder } from '../../shared/utils/storage.util.js';
import { AppError } from '../../shared/middleware/error.middleware.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

// ============================================
// TYPES
// ============================================

interface UploadBody {
  image: string; // Base64 encoded image
  filename: string;
  folder?: StorageFolder;
}

interface PresignedUrlBody {
  filename: string;
  folder?: StorageFolder;
}

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

/**
 * Check if storage is configured
 * GET /api/v1/uploads/status
 */
export async function getStorageStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const configured = isStorageConfigured();

    res.json({
      success: true,
      data: {
        configured,
        folders: Object.values(StorageFolders),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload a base64 encoded image
 * POST /api/v1/uploads/image
 * Body: { image: string (base64), filename: string, folder?: string }
 */
export async function uploadImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isStorageConfigured()) {
      throw new AppError(
        'Storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        true
      );
    }

    const { image, filename, folder = StorageFolders.MENU } = req.body as UploadBody;

    if (!image) {
      throw new AppError(
        'Image data is required',
        HttpStatus.BAD_REQUEST,
        'IMAGE_REQUIRED',
        true
      );
    }

    if (!filename) {
      throw new AppError(
        'Filename is required',
        HttpStatus.BAD_REQUEST,
        'FILENAME_REQUIRED',
        true
      );
    }

    // Validate folder
    const validFolders = Object.values(StorageFolders);
    if (!validFolders.includes(folder as StorageFolder)) {
      throw new AppError(
        `Invalid folder. Valid folders: ${validFolders.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        'INVALID_FOLDER',
        true
      );
    }

    // Validate image size (max 5MB base64)
    const sizeInBytes = (image.length * 3) / 4;
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (sizeInBytes > maxSize) {
      throw new AppError(
        'Image size exceeds 5MB limit',
        HttpStatus.BAD_REQUEST,
        'IMAGE_TOO_LARGE',
        true
      );
    }

    const result = await uploadBase64Image(image, filename, folder);

    if (!result.success) {
      throw new AppError(
        result.error || 'Upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'UPLOAD_FAILED',
        true
      );
    }

    logger.info('Image uploaded', {
      userId: req.user?.id,
      folder,
      key: result.key
    });

    res.status(HttpStatus.CREATED).json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload a file via multipart form data
 * POST /api/v1/uploads/file
 * Body: multipart/form-data with 'file' field
 */
export async function uploadFileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isStorageConfigured()) {
      throw new AppError(
        'Storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        true
      );
    }

    // Check if file exists in request
    // Note: You'll need to add multer middleware for multipart handling
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      throw new AppError(
        'No file uploaded',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
        true
      );
    }

    const folder = (req.body.folder as StorageFolder) || StorageFolders.MENU;

    // Validate folder
    const validFolders = Object.values(StorageFolders);
    if (!validFolders.includes(folder)) {
      throw new AppError(
        `Invalid folder. Valid folders: ${validFolders.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        'INVALID_FOLDER',
        true
      );
    }

    const result = await uploadFile(file.buffer, file.originalname, folder);

    if (!result.success) {
      throw new AppError(
        result.error || 'Upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'UPLOAD_FAILED',
        true
      );
    }

    logger.info('File uploaded', {
      userId: req.user?.id,
      folder,
      key: result.key,
      originalName: file.originalname
    });

    res.status(HttpStatus.CREATED).json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a presigned URL for direct upload
 * POST /api/v1/uploads/presigned
 * Body: { filename: string, folder?: string }
 */
export async function getPresignedUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isStorageConfigured()) {
      throw new AppError(
        'Storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        true
      );
    }

    const { filename, folder = StorageFolders.MENU } = req.body as PresignedUrlBody;

    if (!filename) {
      throw new AppError(
        'Filename is required',
        HttpStatus.BAD_REQUEST,
        'FILENAME_REQUIRED',
        true
      );
    }

    // Validate folder
    const validFolders = Object.values(StorageFolders);
    if (!validFolders.includes(folder as StorageFolder)) {
      throw new AppError(
        `Invalid folder. Valid folders: ${validFolders.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        'INVALID_FOLDER',
        true
      );
    }

    const result = await getUploadPresignedUrl(filename, folder);

    if (!result) {
      throw new AppError(
        'Failed to generate presigned URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PRESIGNED_URL_FAILED',
        true
      );
    }

    res.json({
      success: true,
      data: {
        uploadUrl: result.url,
        key: result.key,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an uploaded file
 * DELETE /api/v1/uploads/:key
 */
export async function deleteUploadedFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isStorageConfigured()) {
      throw new AppError(
        'Storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        true
      );
    }

    const { key } = req.params;

    if (!key) {
      throw new AppError(
        'File key is required',
        HttpStatus.BAD_REQUEST,
        'KEY_REQUIRED',
        true
      );
    }

    // Decode the key (it might be URL encoded)
    const decodedKey = decodeURIComponent(key);

    const success = await deleteFile(decodedKey);

    if (!success) {
      throw new AppError(
        'Failed to delete file',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'DELETE_FAILED',
        true
      );
    }

    logger.info('File deleted', { userId: req.user?.id, key: decodedKey });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getStorageStatus,
  uploadImage,
  uploadFileHandler,
  getPresignedUploadUrl,
  deleteUploadedFile,
};
