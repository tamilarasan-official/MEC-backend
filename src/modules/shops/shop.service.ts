import { Types } from 'mongoose';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Shop, IShopDocument } from './shop.model.js';
import { User } from '../users/user.model.js';
import { CreateShopInput, UpdateShopInput, OwnerDetails } from './shop.validation.js';
import { logger } from '../../config/logger.js';

const SALT_ROUNDS = 12;

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
   * Optionally creates an owner user if ownerDetails is provided
   */
  async createShop(data: CreateShopInput): Promise<{ shop: IShopDocument; owner?: { id: string; email: string; name: string } }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let ownerId: Types.ObjectId | undefined;
      let createdOwner: { id: string; email: string; name: string } | undefined;

      // If ownerDetails provided, create new owner user
      if (data.ownerDetails) {
        const { name, email, password, phone } = data.ownerDetails;

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
        if (existingUser) {
          throw new Error(`User with email ${email} already exists`);
        }

        // Generate username from email
        const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');

        // Check username uniqueness
        let finalUsername = username;
        let counter = 1;
        while (await User.findOne({ username: finalUsername }).session(session)) {
          finalUsername = `${username}_${counter}`;
          counter++;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create shop first (without owner) to get the shop ID
        const shopData = {
          name: data.name,
          description: data.description,
          category: data.category,
          imageUrl: data.imageUrl,
          bannerUrl: data.bannerUrl,
          operatingHours: data.operatingHours,
          contactPhone: data.contactPhone,
        };

        const shop = new Shop(shopData);
        await shop.save({ session });

        // Now create owner with shop reference
        const ownerUser = new User({
          username: finalUsername,
          passwordHash,
          name,
          email: email.toLowerCase(),
          phone,
          role: 'owner',
          isApproved: true, // Owners are auto-approved
          isActive: true,
          balance: 0,
          shop: shop._id,
        });

        await ownerUser.save({ session });

        // Update shop with owner reference
        shop.owner = ownerUser._id;
        await shop.save({ session });

        await session.commitTransaction();

        // Populate owner before returning
        await shop.populate('owner', 'name email phone');

        logger.info(`Shop created with new owner: ${shop.name}`, {
          shopId: shop._id,
          ownerId: ownerUser._id,
          ownerEmail: email,
        });

        return {
          shop,
          owner: {
            id: ownerUser._id.toString(),
            email: ownerUser.email,
            name: ownerUser.name,
          },
        };
      }

      // No ownerDetails, use existing ownerId if provided
      if (data.ownerId) {
        ownerId = new Types.ObjectId(data.ownerId);

        // Update the owner's shop reference
        await User.findByIdAndUpdate(
          ownerId,
          { shop: null }, // Will be updated after shop creation
          { session }
        );
      }

      const shopData = {
        name: data.name,
        description: data.description,
        category: data.category,
        owner: ownerId,
        imageUrl: data.imageUrl,
        bannerUrl: data.bannerUrl,
        operatingHours: data.operatingHours,
        contactPhone: data.contactPhone,
      };

      const shop = new Shop(shopData);
      await shop.save({ session });

      // Update owner's shop reference if ownerId provided
      if (ownerId) {
        await User.findByIdAndUpdate(ownerId, { shop: shop._id }, { session });
      }

      await session.commitTransaction();

      // Populate owner before returning
      await shop.populate('owner', 'name email phone');

      logger.info(`Shop created: ${shop.name}`, { shopId: shop._id });
      return { shop };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error creating shop:', { error, data });
      throw error;
    } finally {
      session.endSession();
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
