/**
 * Owner Service
 * Business logic for owner operations (captain management)
 */

import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, IUserDocument } from '../users/user.model.js';
import { Shop } from '../shops/shop.model.js';
import { CreateCaptainInput } from './owner.validation.js';
import { logger } from '../../config/logger.js';

const SALT_ROUNDS = 12;

// Response type for captain
interface CaptainResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

function transformCaptain(user: IUserDocument): CaptainResponse {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export class OwnerService {
  /**
   * Create a new captain for a shop
   */
  async createCaptain(shopId: string, data: CreateCaptainInput): Promise<CaptainResponse> {
    const { name, email, password, phone } = data;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }

    // Verify shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Generate username from email
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check username uniqueness and generate if needed
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}_${counter}`;
      counter++;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create captain user
    const captain = new User({
      username,
      passwordHash,
      name,
      email: email.toLowerCase(),
      phone,
      role: 'captain',
      isApproved: true, // Captains are auto-approved
      isActive: true,
      balance: 0,
      shop: new Types.ObjectId(shopId),
    });

    await captain.save();

    logger.info('Captain created', {
      captainId: captain._id,
      captainEmail: email,
      shopId,
    });

    return transformCaptain(captain);
  }

  /**
   * Get all captains for a shop
   */
  async getCaptains(shopId: string): Promise<CaptainResponse[]> {
    const captains = await User.find({
      shop: new Types.ObjectId(shopId),
      role: 'captain',
    }).sort({ name: 1 });

    return captains.map(transformCaptain);
  }

  /**
   * Remove (deactivate) a captain
   */
  async removeCaptain(shopId: string, captainId: string): Promise<void> {
    if (!Types.ObjectId.isValid(captainId)) {
      throw new Error('Invalid captain ID');
    }

    const captain = await User.findOne({
      _id: new Types.ObjectId(captainId),
      shop: new Types.ObjectId(shopId),
      role: 'captain',
    });

    if (!captain) {
      throw new Error('Captain not found or does not belong to your shop');
    }

    // Deactivate the captain
    captain.isActive = false;
    await captain.save();

    logger.info('Captain deactivated', {
      captainId,
      shopId,
    });
  }

  /**
   * Get shop details for owner
   */
  async getShopDetails(shopId: string): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    isActive: boolean;
    captainCount: number;
  }> {
    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Count active captains
    const captainCount = await User.countDocuments({
      shop: new Types.ObjectId(shopId),
      role: 'captain',
      isActive: true,
    });

    return {
      id: shop._id.toString(),
      name: shop.name,
      description: shop.description || '',
      category: shop.category,
      isActive: shop.isActive,
      captainCount,
    };
  }
}

export const ownerService = new OwnerService();
export default ownerService;
