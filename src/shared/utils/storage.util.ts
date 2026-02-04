/**
 * Storage Utility
 * Handles file uploads to Garage S3-compatible object storage
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../config/logger.js';

// ============================================
// CONFIGURATION
// ============================================

const GARAGE_ENDPOINT = process.env['GARAGE_ENDPOINT'] || '';
const GARAGE_ACCESS_KEY = process.env['GARAGE_ACCESS_KEY'] || '';
const GARAGE_SECRET_KEY = process.env['GARAGE_SECRET_KEY'] || '';
const GARAGE_BUCKET = process.env['GARAGE_BUCKET'] || 'mecfoodmenu';
const GARAGE_REGION = process.env['GARAGE_REGION'] || 'garage';

// ============================================
// S3 CLIENT
// ============================================

let s3Client: S3Client | null = null;

/**
 * Get or create S3 client for Garage
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    if (!GARAGE_ENDPOINT || !GARAGE_ACCESS_KEY || !GARAGE_SECRET_KEY) {
      throw new Error('Garage storage credentials not configured. Set GARAGE_ENDPOINT, GARAGE_ACCESS_KEY, and GARAGE_SECRET_KEY environment variables.');
    }

    s3Client = new S3Client({
      endpoint: GARAGE_ENDPOINT,
      region: GARAGE_REGION,
      credentials: {
        accessKeyId: GARAGE_ACCESS_KEY,
        secretAccessKey: GARAGE_SECRET_KEY,
      },
      forcePathStyle: true, // Required for S3-compatible storage
    });

    logger.info('Garage S3 client initialized', { endpoint: GARAGE_ENDPOINT, bucket: GARAGE_BUCKET });
  }

  return s3Client;
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Generate a unique key for uploaded files
 */
function generateFileKey(folder: string, originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);

  return `${folder}/${timestamp}-${randomStr}-${sanitizedName}.${extension}`;
}

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Upload a file buffer to Garage storage
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  folder: string = 'menu'
): Promise<UploadResult> {
  try {
    const client = getS3Client();
    const key = generateFileKey(folder, originalName);
    const contentType = getContentType(originalName);

    const command = new PutObjectCommand({
      Bucket: GARAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Make the file publicly readable
      ACL: 'public-read',
    });

    await client.send(command);

    // Construct public URL
    const url = `${GARAGE_ENDPOINT}/${GARAGE_BUCKET}/${key}`;

    logger.info('File uploaded successfully', { key, url, contentType });

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    logger.error('Failed to upload file', { error, originalName, folder });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload a base64 encoded image to Garage storage
 */
export async function uploadBase64Image(
  base64Data: string,
  filename: string,
  folder: string = 'menu'
): Promise<UploadResult> {
  try {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    return await uploadFile(buffer, filename, folder);
  } catch (error) {
    logger.error('Failed to process base64 image', { error, filename });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process image',
    };
  }
}

/**
 * Delete a file from Garage storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: GARAGE_BUCKET,
      Key: key,
    });

    await client.send(command);
    logger.info('File deleted successfully', { key });
    return true;
  } catch (error) {
    logger.error('Failed to delete file', { error, key });
    return false;
  }
}

/**
 * Generate a pre-signed URL for uploading (for direct client uploads)
 */
export async function getUploadPresignedUrl(
  filename: string,
  folder: string = 'menu',
  expiresIn: number = 3600 // 1 hour
): Promise<{ url: string; key: string } | null> {
  try {
    const client = getS3Client();
    const key = generateFileKey(folder, filename);
    const contentType = getContentType(filename);

    const command = new PutObjectCommand({
      Bucket: GARAGE_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    logger.info('Generated upload presigned URL', { key, expiresIn });

    return { url, key };
  } catch (error) {
    logger.error('Failed to generate presigned URL', { error, filename });
    return null;
  }
}

/**
 * Generate a pre-signed URL for downloading (for private files)
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string | null> {
  try {
    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: GARAGE_BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    return url;
  } catch (error) {
    logger.error('Failed to generate download presigned URL', { error, key });
    return null;
  }
}

/**
 * Get the public URL for a stored file
 */
export function getPublicUrl(key: string): string {
  return `${GARAGE_ENDPOINT}/${GARAGE_BUCKET}/${key}`;
}

/**
 * Check if storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(GARAGE_ENDPOINT && GARAGE_ACCESS_KEY && GARAGE_SECRET_KEY);
}

// ============================================
// STORAGE FOLDERS
// ============================================

export const StorageFolders = {
  MENU: 'menu',
  CATEGORIES: 'categories',
  SHOPS: 'shops',
  USERS: 'users',
  OFFERS: 'offers',
} as const;

export type StorageFolder = typeof StorageFolders[keyof typeof StorageFolders];

export default {
  uploadFile,
  uploadBase64Image,
  deleteFile,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  getPublicUrl,
  isStorageConfigured,
  StorageFolders,
};
