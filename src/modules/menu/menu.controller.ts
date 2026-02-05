import { Request, Response, NextFunction } from 'express';
import { menuService } from './menu.service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createFoodItemSchema,
  updateFoodItemSchema,
  setOfferSchema,
  shopIdParamSchema,
  menuItemIdParamSchema,
  menuQuerySchema,
} from './menu.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { AppError } from '../../shared/middleware/error.middleware.js';
import { logger } from '../../config/logger.js';
import { IFoodItemDocument } from './food-item.model.js';

// Transform MongoDB document to frontend-expected format
interface FoodItemResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  image: string;
  imageUrl?: string;
  category: string;
  shopId: string;
  shopName?: string;
  isAvailable: boolean;
  isOffer?: boolean;
  offerPrice?: number;
  rating: number;
  preparationTime: string;
}

function transformFoodItem(item: IFoodItemDocument): FoodItemResponse {
  // Handle populated shop field
  const shop = item.shop as unknown as { _id: string; name: string } | string;
  const shopId = typeof shop === 'object' && shop !== null ? shop._id?.toString() : shop?.toString() || '';
  const shopName = typeof shop === 'object' && shop !== null ? shop.name : undefined;

  // Handle populated category field
  const category = item.category as unknown as { _id: string; name: string } | string;
  const categoryName = typeof category === 'object' && category !== null ? category.name : (category?.toString() || '');

  return {
    id: item._id.toString(),
    name: item.name,
    description: item.description || '',
    price: item.price,
    costPrice: item.costPrice,
    image: item.imageUrl || '/placeholder.svg',
    imageUrl: item.imageUrl,
    category: categoryName,
    shopId: shopId,
    shopName: shopName,
    isAvailable: item.isAvailable,
    isOffer: item.isOffer,
    offerPrice: item.offerPrice,
    rating: item.rating || 4.0,
    preparationTime: item.preparationTime ? `${item.preparationTime} min` : '15 min',
  };
}

export class MenuController {
  // ============================================
  // GLOBAL ROUTES
  // ============================================

  /**
   * GET /menu/items - Get all menu items from all shops (public)
   */
  async getAllItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await menuService.getAllFoodItems();
      const transformedItems = items.map(transformFoodItem);

      res.status(HttpStatus.OK).json({
        success: true,
        data: { items: transformedItems },
        meta: {
          count: transformedItems.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /menu/offers - Get all offers from all shops (public)
   */
  async getAllOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const offers = await menuService.getAllOffers();
      const transformedOffers = offers.map(transformFoodItem);

      res.status(HttpStatus.OK).json({
        success: true,
        data: { items: transformedOffers },
        meta: {
          count: transformedOffers.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // PUBLIC ROUTES
  // ============================================

  /**
   * GET /shops/:shopId/menu - Get menu items (public)
   */
  async getMenuItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const queryResult = menuQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw new AppError('Invalid query parameters', HttpStatus.BAD_REQUEST);
      }

      const items = await menuService.getMenuItems(paramResult.data.shopId, queryResult.data);
      const transformedItems = items.map(transformFoodItem);

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformedItems,
        meta: {
          count: transformedItems.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /shops/:shopId/categories - Get categories (public)
   */
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const categories = await menuService.getCategories(paramResult.data.shopId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: categories,
        meta: {
          count: categories.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /shops/:shopId/offers - Get active offers (public)
   */
  async getOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const offers = await menuService.getOffers(paramResult.data.shopId);
      const transformedOffers = offers.map(transformFoodItem);

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformedOffers,
        meta: {
          count: transformedOffers.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // OWNER ROUTES
  // ============================================

  /**
   * POST /owner/categories - Create category (owner - own shop)
   */
  async createCategoryOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const bodyResult = createCategorySchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const category = await menuService.createCategory(shopId, bodyResult.data);

      logger.info('Category created by owner', {
        categoryId: category._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: category,
        message: 'Category created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /owner/menu - Add menu item (owner - own shop)
   */
  async createFoodItemOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const bodyResult = createFoodItemSchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify category belongs to owner's shop if provided
      if (bodyResult.data.categoryId) {
        const categoryBelongs = await menuService.categoryBelongsToShop(
          bodyResult.data.categoryId,
          shopId
        );
        if (!categoryBelongs) {
          throw new AppError('Category does not belong to your shop', HttpStatus.FORBIDDEN);
        }
      }

      const item = await menuService.createFoodItem(shopId, bodyResult.data);

      logger.info('Food item created by owner', {
        itemId: item._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Food item created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /owner/menu/:id - Update menu item (owner)
   */
  async updateFoodItemOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      // Verify item belongs to owner's shop
      const itemBelongs = await menuService.itemBelongsToShop(paramResult.data.id, shopId);
      if (!itemBelongs) {
        throw new AppError('Menu item not found or access denied', HttpStatus.NOT_FOUND);
      }

      const bodyResult = updateFoodItemSchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify new category belongs to owner's shop if provided
      if (bodyResult.data.categoryId) {
        const categoryBelongs = await menuService.categoryBelongsToShop(
          bodyResult.data.categoryId,
          shopId
        );
        if (!categoryBelongs) {
          throw new AppError('Category does not belong to your shop', HttpStatus.FORBIDDEN);
        }
      }

      const item = await menuService.updateFoodItem(paramResult.data.id, bodyResult.data);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Food item updated by owner', {
        itemId: item._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Food item updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /owner/menu/:id/availability - Toggle availability (owner)
   */
  async toggleAvailabilityOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      // Verify item belongs to owner's shop
      const itemBelongs = await menuService.itemBelongsToShop(paramResult.data.id, shopId);
      if (!itemBelongs) {
        throw new AppError('Menu item not found or access denied', HttpStatus.NOT_FOUND);
      }

      const item = await menuService.toggleAvailability(paramResult.data.id);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Food item availability toggled by owner', {
        itemId: item._id,
        isAvailable: item.isAvailable,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: `Item ${item.isAvailable ? 'marked available' : 'marked unavailable'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /owner/menu/:id/offer - Set offer (owner)
   */
  async setOfferOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      // Verify item belongs to owner's shop
      const itemBelongs = await menuService.itemBelongsToShop(paramResult.data.id, shopId);
      if (!itemBelongs) {
        throw new AppError('Menu item not found or access denied', HttpStatus.NOT_FOUND);
      }

      const bodyResult = setOfferSchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const item = await menuService.setOffer(paramResult.data.id, bodyResult.data);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Offer set by owner', {
        itemId: item._id,
        offerPrice: bodyResult.data.offerPrice,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Offer set successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /owner/menu/:id/offer - Remove offer (owner)
   */
  async removeOfferOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        throw new AppError('Shop not assigned to user', HttpStatus.FORBIDDEN);
      }

      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      // Verify item belongs to owner's shop
      const itemBelongs = await menuService.itemBelongsToShop(paramResult.data.id, shopId);
      if (!itemBelongs) {
        throw new AppError('Menu item not found or access denied', HttpStatus.NOT_FOUND);
      }

      const item = await menuService.removeOffer(paramResult.data.id);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Offer removed by owner', {
        itemId: item._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Offer removed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SUPERADMIN ROUTES
  // ============================================

  /**
   * POST /superadmin/categories - Create category for any shop
   */
  async createCategorySuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shopId, ...categoryData } = req.body;

      if (!shopId) {
        throw new AppError('Shop ID is required', HttpStatus.BAD_REQUEST);
      }

      const bodyResult = createCategorySchema.safeParse(categoryData);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const category = await menuService.createCategory(shopId, bodyResult.data);

      logger.info('Category created by superadmin', {
        categoryId: category._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: category,
        message: 'Category created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /superadmin/menu - Add item to any shop
   */
  async createFoodItemSuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shopId, ...itemData } = req.body;

      if (!shopId) {
        throw new AppError('Shop ID is required', HttpStatus.BAD_REQUEST);
      }

      const bodyResult = createFoodItemSchema.safeParse(itemData);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const item = await menuService.createFoodItem(shopId, bodyResult.data);

      logger.info('Food item created by superadmin', {
        itemId: item._id,
        shopId,
        userId: req.user?.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Food item created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /superadmin/menu/:id - Update any item
   */
  async updateFoodItemSuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      const bodyResult = updateFoodItemSchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const item = await menuService.updateFoodItem(paramResult.data.id, bodyResult.data);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Food item updated by superadmin', {
        itemId: item._id,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Food item updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /superadmin/menu/:id - Delete any item
   */
  async deleteFoodItemSuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = menuItemIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid menu item ID format', HttpStatus.BAD_REQUEST);
      }

      const item = await menuService.deleteFoodItem(paramResult.data.id);

      if (!item) {
        throw new AppError('Menu item not found', HttpStatus.NOT_FOUND);
      }

      logger.info('Food item deleted by superadmin', {
        itemId: item._id,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformFoodItem(item),
        message: 'Food item deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const menuController = new MenuController();
export default menuController;
