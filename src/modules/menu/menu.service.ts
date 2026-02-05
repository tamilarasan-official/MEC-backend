import { Types, FilterQuery } from 'mongoose';
import { Category, ICategoryDocument } from './category.model.js';
import { FoodItem, IFoodItemDocument } from './food-item.model.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateFoodItemInput,
  UpdateFoodItemInput,
  SetOfferInput,
  MenuQuery,
} from './menu.validation.js';
import { logger } from '../../config/logger.js';

export class MenuService {
  // ============================================
  // GLOBAL METHODS
  // ============================================

  /**
   * Get all food items from all active shops
   * @param includeUnavailable - If true, include unavailable items (for admin purposes)
   */
  async getAllFoodItems(includeUnavailable = false): Promise<IFoodItemDocument[]> {
    try {
      const query = includeUnavailable ? {} : { isAvailable: true };
      const items = await FoodItem.find(query)
        .populate('category', 'name icon')
        .populate('shop', 'name')
        .sort({ shop: 1, category: 1, name: 1 });

      logger.info(`Retrieved ${items.length} food items from all shops (includeUnavailable: ${includeUnavailable})`);
      return items;
    } catch (error) {
      logger.error('Error fetching all food items:', { error });
      throw error;
    }
  }

  /**
   * Get all active offers from all shops
   */
  async getAllOffers(): Promise<IFoodItemDocument[]> {
    try {
      const now = new Date();
      const offers = await FoodItem.find({
        isAvailable: true,
        isOffer: true,
        $or: [
          { offerStartDate: { $exists: false }, offerEndDate: { $exists: false } },
          { offerStartDate: { $lte: now }, offerEndDate: { $gte: now } },
          { offerStartDate: { $lte: now }, offerEndDate: { $exists: false } },
          { offerStartDate: { $exists: false }, offerEndDate: { $gte: now } },
        ],
      })
        .populate('category', 'name icon')
        .populate('shop', 'name')
        .sort({ offerEndDate: 1 });

      logger.info(`Retrieved ${offers.length} offers from all shops`);
      return offers;
    } catch (error) {
      logger.error('Error fetching all offers:', { error });
      throw error;
    }
  }

  // ============================================
  // CATEGORY METHODS
  // ============================================

  /**
   * Get all categories for a shop
   */
  async getCategories(shopId: string): Promise<ICategoryDocument[]> {
    try {
      if (!Types.ObjectId.isValid(shopId)) {
        return [];
      }

      const categories = await Category.find({
        shop: new Types.ObjectId(shopId),
        isActive: true,
      }).sort({ sortOrder: 1, name: 1 });

      logger.info(`Retrieved ${categories.length} categories for shop`, { shopId });
      return categories;
    } catch (error) {
      logger.error('Error fetching categories:', { error, shopId });
      throw error;
    }
  }

  /**
   * Create a new category for a shop
   */
  async createCategory(shopId: string, data: CreateCategoryInput): Promise<ICategoryDocument> {
    try {
      const category = new Category({
        ...data,
        shop: new Types.ObjectId(shopId),
      });

      await category.save();

      logger.info(`Category created: ${category.name}`, { shopId, categoryId: category._id });
      return category;
    } catch (error) {
      logger.error('Error creating category:', { error, shopId, data });
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, data: UpdateCategoryInput): Promise<ICategoryDocument | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        return null;
      }

      const category = await Category.findByIdAndUpdate(
        categoryId,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (category) {
        logger.info(`Category updated: ${category.name}`, { categoryId });
      }

      return category;
    } catch (error) {
      logger.error('Error updating category:', { error, categoryId, data });
      throw error;
    }
  }

  /**
   * Delete a category (soft delete by setting isActive to false)
   */
  async deleteCategory(categoryId: string): Promise<ICategoryDocument | null> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        return null;
      }

      const category = await Category.findByIdAndUpdate(
        categoryId,
        { $set: { isActive: false } },
        { new: true }
      );

      if (category) {
        logger.info(`Category deleted: ${category.name}`, { categoryId });
      }

      return category;
    } catch (error) {
      logger.error('Error deleting category:', { error, categoryId });
      throw error;
    }
  }

  // ============================================
  // FOOD ITEM METHODS
  // ============================================

  /**
   * Get menu items for a shop with optional filters
   */
  async getMenuItems(shopId: string, filters: Partial<MenuQuery> = {}): Promise<IFoodItemDocument[]> {
    try {
      if (!Types.ObjectId.isValid(shopId)) {
        return [];
      }

      const query: FilterQuery<IFoodItemDocument> = {
        shop: new Types.ObjectId(shopId),
      };

      if (filters.availableOnly) {
        query['isAvailable'] = true;
      }

      if (filters.categoryId && Types.ObjectId.isValid(filters.categoryId)) {
        query['category'] = new Types.ObjectId(filters.categoryId);
      }

      if (filters.vegetarianOnly) {
        query['isVegetarian'] = true;
      }

      if (filters.minPrice !== undefined) {
        query['price'] = { ...(query['price'] as object || {}), $gte: filters.minPrice };
      }

      if (filters.maxPrice !== undefined) {
        query['price'] = { ...(query['price'] as object || {}), $lte: filters.maxPrice };
      }

      let menuQuery = FoodItem.find(query).populate('category', 'name icon');

      // Text search if provided
      if (filters.search) {
        menuQuery = FoodItem.find({
          ...query,
          $text: { $search: filters.search },
        }).populate('category', 'name icon');
      }

      const items = await menuQuery.sort({ category: 1, name: 1 });

      logger.info(`Retrieved ${items.length} menu items for shop`, { shopId, filters });
      return items;
    } catch (error) {
      logger.error('Error fetching menu items:', { error, shopId, filters });
      throw error;
    }
  }

  /**
   * Get active offers for a shop
   */
  async getOffers(shopId: string): Promise<IFoodItemDocument[]> {
    try {
      if (!Types.ObjectId.isValid(shopId)) {
        return [];
      }

      const now = new Date();
      const offers = await FoodItem.find({
        shop: new Types.ObjectId(shopId),
        isAvailable: true,
        isOffer: true,
        $or: [
          // No date range - always active
          { offerStartDate: { $exists: false }, offerEndDate: { $exists: false } },
          // Within date range
          { offerStartDate: { $lte: now }, offerEndDate: { $gte: now } },
          // Only start date - after start
          { offerStartDate: { $lte: now }, offerEndDate: { $exists: false } },
          // Only end date - before end
          { offerStartDate: { $exists: false }, offerEndDate: { $gte: now } },
        ],
      })
        .populate('category', 'name icon')
        .sort({ offerEndDate: 1 });

      logger.info(`Retrieved ${offers.length} offers for shop`, { shopId });
      return offers;
    } catch (error) {
      logger.error('Error fetching offers:', { error, shopId });
      throw error;
    }
  }

  /**
   * Get a single food item by ID
   */
  async getFoodItemById(itemId: string): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      const item = await FoodItem.findById(itemId).populate('category', 'name icon');

      return item;
    } catch (error) {
      logger.error('Error fetching food item:', { error, itemId });
      throw error;
    }
  }

  /**
   * Create a new food item
   */
  async createFoodItem(shopId: string, data: CreateFoodItemInput): Promise<IFoodItemDocument> {
    try {
      const itemData = {
        ...data,
        shop: new Types.ObjectId(shopId),
        category: data.categoryId ? new Types.ObjectId(data.categoryId) : undefined,
      };

      // Remove categoryId as we've mapped it to category
      const { categoryId: _categoryId, ...cleanData } = itemData;

      const item = new FoodItem(cleanData);
      await item.save();

      await item.populate('category', 'name icon');

      logger.info(`Food item created: ${item.name}`, { shopId, itemId: item._id });
      return item;
    } catch (error) {
      logger.error('Error creating food item:', { error, shopId, data });
      throw error;
    }
  }

  /**
   * Update a food item
   */
  async updateFoodItem(itemId: string, data: UpdateFoodItemInput): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      // Map categoryId to category if provided
      const updateData: Record<string, unknown> = { ...data };
      if ('categoryId' in data) {
        updateData['category'] = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
        delete updateData['categoryId'];
      }

      const item = await FoodItem.findByIdAndUpdate(
        itemId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('category', 'name icon');

      if (item) {
        logger.info(`Food item updated: ${item.name}`, { itemId });
      }

      return item;
    } catch (error) {
      logger.error('Error updating food item:', { error, itemId, data });
      throw error;
    }
  }

  /**
   * Delete a food item (hard delete)
   */
  async deleteFoodItem(itemId: string): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      const item = await FoodItem.findByIdAndDelete(itemId);

      if (item) {
        logger.info(`Food item deleted: ${item.name}`, { itemId });
      }

      return item;
    } catch (error) {
      logger.error('Error deleting food item:', { error, itemId });
      throw error;
    }
  }

  /**
   * Toggle food item availability
   */
  async toggleAvailability(itemId: string): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      const item = await FoodItem.findById(itemId);
      if (!item) {
        return null;
      }

      item.isAvailable = !item.isAvailable;
      await item.save();

      await item.populate('category', 'name icon');

      logger.info(`Food item availability toggled: ${item.name}`, {
        itemId,
        isAvailable: item.isAvailable,
      });

      return item;
    } catch (error) {
      logger.error('Error toggling food item availability:', { error, itemId });
      throw error;
    }
  }

  /**
   * Set offer on a food item
   */
  async setOffer(itemId: string, offerData: SetOfferInput): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      const item = await FoodItem.findById(itemId);
      if (!item) {
        return null;
      }

      // Validate offer price is less than regular price
      if (offerData.offerPrice >= item.price) {
        throw new Error('Offer price must be less than regular price');
      }

      item.isOffer = true;
      item.offerPrice = offerData.offerPrice;
      item.offerEndDate = new Date(offerData.offerEndDate);

      await item.save();
      await item.populate('category', 'name icon');

      logger.info(`Offer set on food item: ${item.name}`, {
        itemId,
        offerPrice: offerData.offerPrice,
        offerEndDate: offerData.offerEndDate,
      });

      return item;
    } catch (error) {
      logger.error('Error setting offer on food item:', { error, itemId, offerData });
      throw error;
    }
  }

  /**
   * Remove offer from a food item
   */
  async removeOffer(itemId: string): Promise<IFoodItemDocument | null> {
    try {
      if (!Types.ObjectId.isValid(itemId)) {
        return null;
      }

      const item = await FoodItem.findByIdAndUpdate(
        itemId,
        {
          $set: { isOffer: false },
          $unset: { offerPrice: 1, offerStartDate: 1, offerEndDate: 1 },
        },
        { new: true }
      ).populate('category', 'name icon');

      if (item) {
        logger.info(`Offer removed from food item: ${item.name}`, { itemId });
      }

      return item;
    } catch (error) {
      logger.error('Error removing offer from food item:', { error, itemId });
      throw error;
    }
  }

  /**
   * Check if a food item belongs to a specific shop
   */
  async itemBelongsToShop(itemId: string, shopId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(itemId) || !Types.ObjectId.isValid(shopId)) {
        return false;
      }

      const count = await FoodItem.countDocuments({
        _id: itemId,
        shop: shopId,
      });

      return count > 0;
    } catch (error) {
      logger.error('Error checking item ownership:', { error, itemId, shopId });
      throw error;
    }
  }

  /**
   * Check if a category belongs to a specific shop
   */
  async categoryBelongsToShop(categoryId: string, shopId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(shopId)) {
        return false;
      }

      const count = await Category.countDocuments({
        _id: categoryId,
        shop: shopId,
        isActive: true,
      });

      return count > 0;
    } catch (error) {
      logger.error('Error checking category ownership:', { error, categoryId, shopId });
      throw error;
    }
  }
}

// Export singleton instance
export const menuService = new MenuService();
export default menuService;
