import { Types } from 'mongoose';
import { Shop, IShopDocument } from './shop.model.js';
import { CreateShopInput, UpdateShopInput } from './shop.validation.js';
import { logger } from '../../config/logger.js';

export class ShopService {
  /**
   * Get all shops with optional filtering
   */
  async getAllShops(activeOnly: boolean = true): Promise<IShopDocument[]> {
    try {
      const query = activeOnly ? { isActive: true } : {};
      const shops = await Shop.find(query)
        .populate('owner', 'name email phone')
        .sort({ rating: -1, name: 1 });

      logger.info(`Retrieved ${shops.length} shops`, { activeOnly });
      return shops;
    } catch (error) {
      logger.error('Error fetching shops:', { error });
      throw error;
    }
  }

  /**
   * Get a shop by ID with owner populated
   */
  async getShopById(id: string): Promise<IShopDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const shop = await Shop.findById(id).populate('owner', 'name email phone');

      if (shop) {
        logger.info(`Retrieved shop: ${shop.name}`, { shopId: id });
      }

      return shop;
    } catch (error) {
      logger.error('Error fetching shop by ID:', { error, shopId: id });
      throw error;
    }
  }

  /**
   * Create a new shop (superadmin only)
   */
  async createShop(data: CreateShopInput): Promise<IShopDocument> {
    try {
      const shopData = {
        ...data,
        owner: data.ownerId ? new Types.ObjectId(data.ownerId) : undefined,
      };

      // Remove ownerId from shopData since we mapped it to owner
      const { ownerId: _ownerId, ...cleanData } = shopData;

      const shop = new Shop(cleanData);
      await shop.save();

      // Populate owner before returning
      await shop.populate('owner', 'name email phone');

      logger.info(`Shop created: ${shop.name}`, { shopId: shop._id });
      return shop;
    } catch (error) {
      logger.error('Error creating shop:', { error, data });
      throw error;
    }
  }

  /**
   * Update a shop
   */
  async updateShop(id: string, data: UpdateShopInput): Promise<IShopDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      // Map ownerId to owner if provided
      const updateData: Record<string, unknown> = { ...data };
      if ('ownerId' in data) {
        updateData['owner'] = data.ownerId ? new Types.ObjectId(data.ownerId) : null;
        delete updateData['ownerId'];
      }

      const shop = await Shop.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('owner', 'name email phone');

      if (shop) {
        logger.info(`Shop updated: ${shop.name}`, { shopId: id });
      }

      return shop;
    } catch (error) {
      logger.error('Error updating shop:', { error, shopId: id, data });
      throw error;
    }
  }

  /**
   * Toggle shop active status
   */
  async toggleShopStatus(id: string): Promise<IShopDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const shop = await Shop.findById(id);
      if (!shop) {
        return null;
      }

      shop.isActive = !shop.isActive;
      await shop.save();

      await shop.populate('owner', 'name email phone');

      logger.info(`Shop status toggled: ${shop.name}`, {
        shopId: id,
        isActive: shop.isActive
      });

      return shop;
    } catch (error) {
      logger.error('Error toggling shop status:', { error, shopId: id });
      throw error;
    }
  }

  /**
   * Get shops by category
   */
  async getShopsByCategory(category: string, activeOnly: boolean = true): Promise<IShopDocument[]> {
    try {
      const query = activeOnly
        ? { category, isActive: true }
        : { category };

      const shops = await Shop.find(query)
        .populate('owner', 'name email phone')
        .sort({ rating: -1, name: 1 });

      logger.info(`Retrieved ${shops.length} shops in category: ${category}`);
      return shops;
    } catch (error) {
      logger.error('Error fetching shops by category:', { error, category });
      throw error;
    }
  }

  /**
   * Get shop by owner ID
   */
  async getShopByOwner(ownerId: string): Promise<IShopDocument | null> {
    try {
      if (!Types.ObjectId.isValid(ownerId)) {
        return null;
      }

      const shop = await Shop.findOne({ owner: new Types.ObjectId(ownerId) })
        .populate('owner', 'name email phone');

      return shop;
    } catch (error) {
      logger.error('Error fetching shop by owner:', { error, ownerId });
      throw error;
    }
  }

  /**
   * Check if a shop exists
   */
  async shopExists(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return false;
      }
      const count = await Shop.countDocuments({ _id: id });
      return count > 0;
    } catch (error) {
      logger.error('Error checking shop existence:', { error, shopId: id });
      throw error;
    }
  }
}

// Export singleton instance
export const shopService = new ShopService();
export default shopService;
