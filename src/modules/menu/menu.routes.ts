import { Router } from 'express';
import { menuController } from './menu.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../../shared/middleware/validate.middleware.js';
import {
  createCategorySchema,
  createFoodItemSchema,
  updateFoodItemSchema,
  setOfferSchema,
  shopIdParamSchema,
  menuItemIdParamSchema,
  menuQuerySchema,
} from './menu.validation.js';

// ============================================
// GLOBAL PUBLIC ROUTES - /menu
// ============================================

export const menuGlobalRoutes = Router();

// GET /menu/items - Get all menu items from all shops (public)
menuGlobalRoutes.get('/items', (req, res, next) => menuController.getAllItems(req, res, next));

// GET /menu/offers - Get all offers from all shops (public)
menuGlobalRoutes.get('/offers', (req, res, next) => menuController.getAllOffers(req, res, next));

// ============================================
// PUBLIC ROUTES - Nested under /shops/:shopId
// ============================================

export const menuPublicRoutes = Router({ mergeParams: true });

// GET /shops/:shopId/menu - Get menu items (public)
menuPublicRoutes.get(
  '/menu',
  validateParams(shopIdParamSchema),
  validateQuery(menuQuerySchema),
  (req, res, next) => menuController.getMenuItems(req, res, next)
);

// GET /shops/:shopId/categories - Get categories (public)
menuPublicRoutes.get(
  '/categories',
  validateParams(shopIdParamSchema),
  (req, res, next) => menuController.getCategories(req, res, next)
);

// GET /shops/:shopId/offers - Get active offers (public)
menuPublicRoutes.get(
  '/offers',
  validateParams(shopIdParamSchema),
  (req, res, next) => menuController.getOffers(req, res, next)
);

// ============================================
// OWNER ROUTES - /owner/...
// ============================================

export const menuOwnerRoutes = Router();

// All owner routes require owner or superadmin role
menuOwnerRoutes.use(requireAuth('owner', 'superadmin'));

// POST /owner/categories - Create category for own shop
menuOwnerRoutes.post(
  '/categories',
  validate(createCategorySchema),
  (req, res, next) => menuController.createCategoryOwner(req, res, next)
);

// POST /owner/menu - Add menu item to own shop
menuOwnerRoutes.post(
  '/menu',
  validate(createFoodItemSchema),
  (req, res, next) => menuController.createFoodItemOwner(req, res, next)
);

// PUT /owner/menu/:id - Update menu item
menuOwnerRoutes.put(
  '/menu/:id',
  validateParams(menuItemIdParamSchema),
  validate(updateFoodItemSchema),
  (req, res, next) => menuController.updateFoodItemOwner(req, res, next)
);

// PATCH /owner/menu/:id/availability - Toggle availability
menuOwnerRoutes.patch(
  '/menu/:id/availability',
  validateParams(menuItemIdParamSchema),
  (req, res, next) => menuController.toggleAvailabilityOwner(req, res, next)
);

// POST /owner/menu/:id/offer - Set offer on item
menuOwnerRoutes.post(
  '/menu/:id/offer',
  validateParams(menuItemIdParamSchema),
  validate(setOfferSchema),
  (req, res, next) => menuController.setOfferOwner(req, res, next)
);

// DELETE /owner/menu/:id/offer - Remove offer from item
menuOwnerRoutes.delete(
  '/menu/:id/offer',
  validateParams(menuItemIdParamSchema),
  (req, res, next) => menuController.removeOfferOwner(req, res, next)
);

// ============================================
// SUPERADMIN ROUTES - /superadmin/...
// ============================================

export const menuSuperadminRoutes = Router();

// All superadmin routes require superadmin role
menuSuperadminRoutes.use(requireAuth('superadmin'));

// GET /superadmin/menu - Get all menu items including unavailable (superadmin)
menuSuperadminRoutes.get('/menu', (req, res, next) => menuController.getAllItemsSuperadmin(req, res, next));

// POST /superadmin/categories - Create category for any shop
menuSuperadminRoutes.post(
  '/categories',
  validate(createCategorySchema),
  (req, res, next) => menuController.createCategorySuperadmin(req, res, next)
);

// POST /superadmin/menu - Add item to any shop
menuSuperadminRoutes.post(
  '/menu',
  validate(createFoodItemSchema),
  (req, res, next) => menuController.createFoodItemSuperadmin(req, res, next)
);

// PUT /superadmin/menu/:id - Update any item
menuSuperadminRoutes.put(
  '/menu/:id',
  validateParams(menuItemIdParamSchema),
  validate(updateFoodItemSchema),
  (req, res, next) => menuController.updateFoodItemSuperadmin(req, res, next)
);

// DELETE /superadmin/menu/:id - Delete any item
menuSuperadminRoutes.delete(
  '/menu/:id',
  validateParams(menuItemIdParamSchema),
  (req, res, next) => menuController.deleteFoodItemSuperadmin(req, res, next)
);

export default { menuGlobalRoutes, menuPublicRoutes, menuOwnerRoutes, menuSuperadminRoutes };
