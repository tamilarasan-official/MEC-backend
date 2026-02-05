import { Types } from 'mongoose';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Shop, IShopDocument } from './shop.model.js';
import { User } from '../users/user.model.js';
import { CreateShopInput, UpdateShopInput, OwnerDetails, UpdateOwnerDetails } from './shop.validation.js';
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
    logger.info('createShop called with data:', {
      name: data.name,
      category: data.category,
      hasOwnerDetails: !!data.ownerDetails,
      ownerEmail: data.ownerDetails?.email,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let ownerId: Types.ObjectId | undefined;
      let createdOwner: { id: string; email: string; name: string } | undefined;

      // If ownerDetails provided, create new owner user
      if (data.ownerDetails) {
        logger.info('Creating owner user with details:', {
          name: data.ownerDetails.name,
          email: data.ownerDetails.email,
          hasPassword: !!data.ownerDetails.password,
          phone: data.ownerDetails.phone,
        });

        const { name, email, password, phone } = data.ownerDetails;

        // Check if email already exists
        const emailToCheck = email.toLowerCase();
        logger.info('Checking if email exists:', { email: emailToCheck });
        const existingUser = await User.findOne({ email: emailToCheck }).session(session);
        logger.info('Email check result:', {
          email: emailToCheck,
          found: !!existingUser,
          existingUserId: existingUser?._id?.toString(),
        });
        if (existingUser) {
          throw new Error(`User with email ${email} already exists`);
        }

        // Generate username from email
        const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
        logger.info('Generated username from email:', { email, username });

        // Check username uniqueness
        let finalUsername = username;
        let counter = 1;
        while (await User.findOne({ username: finalUsername }).session(session)) {
          logger.info('Username already taken, trying next:', { username: finalUsername });
          finalUsername = `${username}_${counter}`;
          counter++;
        }
        logger.info('Final username to use:', { finalUsername });

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
        logger.info('Owner user created successfully:', {
          userId: ownerUser._id.toString(),
          email: ownerUser.email,
          role: ownerUser.role,
          shopId: ownerUser.shop?.toString(),
        });

        // Update shop with owner reference
        shop.owner = ownerUser._id;
        await shop.save({ session });
        logger.info('Shop updated with owner reference:', {
          shopId: shop._id.toString(),
          ownerId: shop.owner?.toString(),
        });

        await session.commitTransaction();
        logger.info('Transaction committed successfully for shop and owner creation');

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

      // Check for MongoDB duplicate key error
      const mongoError = error as { code?: number; keyPattern?: Record<string, number>; keyValue?: Record<string, string> };
      const isDuplicateKeyError = mongoError.code === 11000;

      logger.error('Error creating shop - transaction aborted:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        shopName: data.name,
        category: data.category,
        ownerEmail: data.ownerDetails?.email,
        mongoErrorCode: mongoError.code,
        isDuplicateKeyError,
        keyPattern: mongoError.keyPattern,
        keyValue: mongoError.keyValue,
      });

      // Convert MongoDB duplicate key error to user-friendly message
      if (isDuplicateKeyError) {
        const field = Object.keys(mongoError.keyPattern || {})[0] || 'field';
        const value = mongoError.keyValue ? Object.values(mongoError.keyValue)[0] : 'value';
        throw new Error(`A user with this ${field} (${value}) already exists`);
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update a shop
   * Optionally updates owner credentials if ownerDetails is provided
   */
  async updateShop(id: string, data: UpdateShopInput): Promise<IShopDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Map ownerId to owner if provided
        const updateData: Record<string, unknown> = { ...data };
        if ('ownerId' in data) {
          updateData['owner'] = data.ownerId ? new Types.ObjectId(data.ownerId) : null;
          delete updateData['ownerId'];
        }

        // Handle owner details update separately
        if ('ownerDetails' in updateData) {
          delete updateData['ownerDetails'];
        }

        // Update shop
        const shop = await Shop.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true, session }
        ).populate('owner', 'name email phone');

        if (!shop) {
          await session.abortTransaction();
          return null;
        }

        // Update owner credentials if provided
        if (data.ownerDetails && shop.owner) {
          const ownerId = typeof shop.owner === 'object' && shop.owner !== null
            ? (shop.owner as { _id: Types.ObjectId })._id
            : shop.owner;

          await this.updateOwnerCredentials(ownerId.toString(), data.ownerDetails, session);
          logger.info('Owner credentials updated', { shopId: id, ownerId: ownerId.toString() });
        }

        await session.commitTransaction();

        // Re-populate owner after transaction
        await shop.populate('owner', 'name email phone');

        logger.info(`Shop updated: ${shop.name}`, { shopId: id });
        return shop;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error('Error updating shop:', { error, shopId: id, data });
      throw error;
    }
  }

  /**
   * Update owner credentials (name, password, phone)
   */
  private async updateOwnerCredentials(
    ownerId: string,
    details: UpdateOwnerDetails,
    session: mongoose.ClientSession
  ): Promise<void> {
    const owner = await User.findById(ownerId).session(session);
    if (!owner) {
      throw new Error('Owner not found');
    }

    // Update fields
    if (details.name) {
      owner.name = details.name;
    }

    if (details.phone !== undefined) {
      owner.phone = details.phone || undefined;
    }

    if (details.password) {
      const passwordHash = await bcrypt.hash(details.password, SALT_ROUNDS);
      owner.passwordHash = passwordHash;
    }

    await owner.save({ session });
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
