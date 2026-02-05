import { Router } from 'express';
import { shopController } from './shop.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate, validateParams } from '../../shared/middleware/validate.middleware.js';
import { createShopSchema, updateShopSchema, shopIdParamSchema, shopQuerySchema } from './shop.validation.js';

// Public routes for shops
export const shopPublicRoutes = Router();

// GET /shops - List active shops (public)
shopPublicRoutes.get('/', (req, res, next) => shopController.getAllShops(req, res, next));

// GET /shops/:id - Get shop details (public)
shopPublicRoutes.get(
  '/:id',
  validateParams(shopIdParamSchema),
  (req, res, next) => shopController.getShopById(req, res, next)
);

// Superadmin routes for shop management
export const shopSuperadminRoutes = Router();

// All superadmin shop routes require superadmin role
shopSuperadminRoutes.use(requireAuth('superadmin'));

// POST /superadmin/shops - Create shop
shopSuperadminRoutes.post(
  '/',
  validate(createShopSchema),
  (req, res, next) => shopController.createShop(req, res, next)
);

// PUT /superadmin/shops/:id - Update shop
shopSuperadminRoutes.put(
  '/:id',
  validateParams(shopIdParamSchema),
  validate(updateShopSchema),
  (req, res, next) => shopController.updateShop(req, res, next)
);

// DELETE /superadmin/shops/:id - Deactivate shop
shopSuperadminRoutes.delete(
  '/:id',
  validateParams(shopIdParamSchema),
  (req, res, next) => shopController.deactivateShop(req, res, next)
);

// PATCH /superadmin/shops/:id/toggle - Toggle shop status
shopSuperadminRoutes.patch(
  '/:id/toggle',
  validateParams(shopIdParamSchema),
  (req, res, next) => shopController.toggleShopStatus(req, res, next)
);

export default { shopPublicRoutes, shopSuperadminRoutes };
