/**
 * Image Proxy Controller
 * Proxies image requests to Garage S3 storage (since Garage doesn't support anonymous access)
 */

import { Request, Response, NextFunction } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../config/logger.js';
import { Readable } from 'stream';

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

    // Construct the S3 key
    const key = `${folder}/${filename}`;

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
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };

    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    logger.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
}

export default { proxyImage };
