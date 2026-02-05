import { Request, Response, NextFunction } from 'express';
import { shopService } from './shop.service.js';
import {
  createShopSchema,
  updateShopSchema,
  shopIdParamSchema,
  shopQuerySchema,
} from './shop.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { AppError } from '../../shared/middleware/error.middleware.js';
import { logger } from '../../config/logger.js';
import { IShopDocument } from './shop.model.js';

// Transform MongoDB document to frontend-expected format
interface ShopResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  ownerId?: string;
  imageUrl?: string;
  bannerUrl?: string;
  rating?: number;
  totalOrders?: number;
  contactPhone?: string;
}

function transformShop(shop: IShopDocument): ShopResponse {
  const owner = shop.owner as unknown as { _id: string } | string | undefined;
  const ownerId = owner
    ? (typeof owner === 'object' && owner !== null ? owner._id?.toString() : owner?.toString())
    : undefined;

  return {
    id: shop._id.toString(),
    name: shop.name,
    description: shop.description || '',
    category: shop.category,
    isActive: shop.isActive,
    ownerId: ownerId,
    imageUrl: shop.imageUrl,
    bannerUrl: shop.bannerUrl,
    rating: shop.rating,
    totalOrders: shop.totalOrders,
    contactPhone: shop.contactPhone,
  };
}

export class ShopController {
  /**
   * GET /shops - List active shops (public)
   */
  async getAllShops(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = shopQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        throw new AppError('Invalid query parameters', HttpStatus.BAD_REQUEST);
      }

      const { activeOnly = true } = queryResult.data;
      const shops = await shopService.getAllShops(activeOnly);
      const transformedShops = shops.map(transformShop);

      res.status(HttpStatus.OK).json({
        success: true,
        data: { shops: transformedShops },
        meta: {
          count: transformedShops.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /shops/:id - Get shop details (public)
   */
  async getShopById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);

      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const shop = await shopService.getShopById(paramResult.data.id);

      if (!shop) {
        throw new AppError('Shop not found', HttpStatus.NOT_FOUND);
      }

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformShop(shop),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /superadmin/shops - Create shop (superadmin only)
   */
  async createShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bodyResult = createShopSchema.safeParse(req.body);

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

      const shop = await shopService.createShop(bodyResult.data);

      logger.info(`Shop created by superadmin`, {
        shopId: shop._id,
        shopName: shop.name,
        userId: req.user?.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: transformShop(shop),
        message: 'Shop created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /superadmin/shops/:id - Update shop (superadmin only)
   */
  async updateShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);

      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const bodyResult = updateShopSchema.safeParse(req.body);

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

      const shop = await shopService.updateShop(paramResult.data.id, bodyResult.data);

      if (!shop) {
        throw new AppError('Shop not found', HttpStatus.NOT_FOUND);
      }

      logger.info(`Shop updated by superadmin`, {
        shopId: shop._id,
        shopName: shop.name,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformShop(shop),
        message: 'Shop updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /superadmin/shops/:id - Deactivate shop (superadmin only)
   */
  async deactivateShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);

      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const shop = await shopService.getShopById(paramResult.data.id);

      if (!shop) {
        throw new AppError('Shop not found', HttpStatus.NOT_FOUND);
      }

      // Deactivate the shop instead of deleting
      const updatedShop = await shopService.updateShop(paramResult.data.id, { isActive: false });

      logger.info(`Shop deactivated by superadmin`, {
        shopId: shop._id,
        shopName: shop.name,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: updatedShop ? transformShop(updatedShop) : null,
        message: 'Shop deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /superadmin/shops/:id/toggle - Toggle shop status (superadmin only)
   */
  async toggleShopStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = shopIdParamSchema.safeParse(req.params);

      if (!paramResult.success) {
        throw new AppError('Invalid shop ID format', HttpStatus.BAD_REQUEST);
      }

      const shop = await shopService.toggleShopStatus(paramResult.data.id);

      if (!shop) {
        throw new AppError('Shop not found', HttpStatus.NOT_FOUND);
      }

      logger.info(`Shop status toggled by superadmin`, {
        shopId: shop._id,
        shopName: shop.name,
        isActive: shop.isActive,
        userId: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: transformShop(shop),
        message: `Shop ${shop.isActive ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const shopController = new ShopController();
export default shopController;
