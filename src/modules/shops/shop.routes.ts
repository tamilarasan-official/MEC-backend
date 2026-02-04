import { Router } from 'express';
import { shopController } from './shop.controller.js';

// Public routes for shops
export const shopPublicRoutes = Router();

// GET /shops - List active shops (public)
shopPublicRoutes.get('/', (req, res, next) => shopController.getAllShops(req, res, next));

// GET /shops/:id - Get shop details (public)
shopPublicRoutes.get('/:id', (req, res, next) => shopController.getShopById(req, res, next));

// Superadmin routes for shop management
export const shopSuperadminRoutes = Router();

// POST /superadmin/shops - Create shop
shopSuperadminRoutes.post('/', (req, res, next) => shopController.createShop(req, res, next));

// PUT /superadmin/shops/:id - Update shop
shopSuperadminRoutes.put('/:id', (req, res, next) => shopController.updateShop(req, res, next));

// DELETE /superadmin/shops/:id - Deactivate shop
shopSuperadminRoutes.delete('/:id', (req, res, next) => shopController.deactivateShop(req, res, next));

// PATCH /superadmin/shops/:id/toggle - Toggle shop status
shopSuperadminRoutes.patch('/:id/toggle', (req, res, next) => shopController.toggleShopStatus(req, res, next));

export default { shopPublicRoutes, shopSuperadminRoutes };
