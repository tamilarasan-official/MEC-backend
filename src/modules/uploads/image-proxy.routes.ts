/**
 * Image Proxy Routes
 * Public routes for proxying images from Garage S3
 */

import { Router } from 'express';
import { proxyImage } from './image-proxy.controller.js';

const router = Router();

// GET /api/v1/images/:folder/:filename - Proxy image from Garage
// Example: /api/v1/images/meccanteen/idly.png
router.get('/:folder/:filename', proxyImage);

export default router;
