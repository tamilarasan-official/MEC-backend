/**
 * Image Proxy Controller
 * Proxies image requests to Garage S3 storage (since Garage doesn't support anonymous access)
 */

import { Request, Response, NextFunction } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../config/logger.js';
import { Readable } from 'stream';
import { validateImageProxyParams } from './image-proxy.validation.js';

// Garage S3 configuration
const GARAGE_ENDPOINT = process.env['GARAGE_ENDPOINT'] || '';
const GARAGE_ACCESS_KEY = process.env['GARAGE_ACCESS_KEY'] || '';
const GARAGE_SECRET_KEY = process.env['GARAGE_SECRET_KEY'] || '';
const GARAGE_BUCKET = process.env['GARAGE_BUCKET'] || 'mecfoodmenu';
const GARAGE_REGION = process.env['GARAGE_REGION'] || 'garage';

// Cache S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!GARAGE_ENDPOINT || !GARAGE_ACCESS_KEY || !GARAGE_SECRET_KEY) {
      throw new Error('Garage storage credentials not configured');
    }

    s3Client = new S3Client({
      endpoint: GARAGE_ENDPOINT,
      region: GARAGE_REGION,
      credentials: {
        accessKeyId: GARAGE_ACCESS_KEY,
        secretAccessKey: GARAGE_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

/**
 * Proxy image from Garage S3
 * GET /api/v1/images/:folder/:filename
 */
export async function proxyImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { folder, filename } = req.params;

    if (!folder || !filename) {
      res.status(400).json({ error: 'Missing folder or filename' });
      return;
    }

    // Decode URL-encoded characters (e.g., %20 -> space)
    const decodedFolder = decodeURIComponent(folder);
    const decodedFilename = decodeURIComponent(filename);

    // Validate parameters to prevent path traversal attacks
    const validation = validateImageProxyParams({
      folder: decodedFolder,
      filename: decodedFilename,
    });

    if (!validation.success) {
      logger.warn('Image proxy validation failed', {
        folder: decodedFolder,
        filename: decodedFilename,
        errors: validation.errors.map(e => e.message),
        ip: req.ip,
      });
      res.status(400).json({ error: 'Invalid image path' });
      return;
    }

    // Construct the S3 key using validated data
    const key = `${validation.data.folder}/${validation.data.filename}`;

    logger.info('Image proxy request', { folder: validation.data.folder, filename: validation.data.filename });

    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: GARAGE_BUCKET,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    // Set appropriate headers
    res.setHeader('Content-Type', response.ContentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }

    // Stream the image to the response
    if (response.Body instanceof Readable) {
      response.Body.pipe(res);
    } else {
      // For web streams, convert to buffer
      const chunks: Uint8Array[] = [];
      const reader = (response.Body as ReadableStream).getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    }
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number }; message?: string };

    // Log the full error for debugging
    logger.error('Image proxy error:', {
      name: err.name,
      code: err.code,
      message: err.message,
      httpStatus: err.$metadata?.httpStatusCode,
      folder: req.params.folder,
      filename: req.params.filename,
    });

    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404 || err.code === 'NoSuchKey') {
      // Don't expose internal key paths in response
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    if (err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
      res.status(403).json({ error: 'Access denied to image' });
      return;
    }

    // Don't expose internal error details to client
    res.status(500).json({ error: 'Failed to fetch image' });
  }
}

export default { proxyImage };
