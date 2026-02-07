/**
 * Superadmin Service
 * Business logic for superadmin dashboard and management
 */

import { Types } from 'mongoose';
import { User } from '../users/user.model.js';
import { Shop } from '../shops/shop.model.js';
import { Order } from '../orders/order.model.js';
import { FoodItem } from '../menu/food-item.model.js';
import { PaymentRequest } from '../adhoc-payments/payment-request.model.js';
import { PaymentSubmission } from '../adhoc-payments/payment-submission.model.js';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  users: {
    total: number;
    students: number;
    captains: number;
    owners: number;
    accountants: number;
    superadmins: number;
    pendingApproval: number;
    activeToday: number;
  };
  shops: {
    total: number;
    active: number;
    inactive: number;
  };
  orders: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    completed: number;
    cancelled: number;
    todayCount: number;
    todayRevenue: number;
  };
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    // Breakdown
    ordersTotal: number;
    adhocPaymentsTotal: number;
  };
  adhocPayments: {
    totalCollected: number;
    activeRequests: number;
    totalRequests: number;
    todayCollected: number;
    thisMonthCollected: number;
  };
  menu: {
    totalItems: number;
    availableItems: number;
  };
}

interface OrderQueryOptions {
  page: number;
  limit: number;
  status?: string;
  shopId?: string;
}

interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ============================================
// SERVICE CLASS
// ============================================

class SuperadminService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for performance
    const [
      userStats,
      shopStats,
      orderStatusStats,
      todayOrderStats,
      orderRevenueStats,
      adhocPaymentStats,
      menuStats,
    ] = await Promise.all([
      this.getUserStats(todayStart),
      this.getShopStats(),
      this.getOrderStatusStats(),
      this.getTodayOrderStats(todayStart),
      this.getOrderRevenueStats(todayStart, weekStart, monthStart),
      this.getAdhocPaymentStats(todayStart, monthStart),
      this.getMenuStats(),
    ]);

    // Combine order revenue and adhoc payments for total revenue
    const combinedRevenue = {
      total: orderRevenueStats.total + adhocPaymentStats.totalCollected,
      today: orderRevenueStats.today + adhocPaymentStats.todayCollected,
      thisWeek: orderRevenueStats.thisWeek + adhocPaymentStats.thisWeekCollected,
      thisMonth: orderRevenueStats.thisMonth + adhocPaymentStats.thisMonthCollected,
      ordersTotal: orderRevenueStats.total,
      adhocPaymentsTotal: adhocPaymentStats.totalCollected,
    };

    return {
      users: userStats,
      shops: shopStats,
      orders: {
        ...orderStatusStats,
        todayCount: todayOrderStats.count,
        todayRevenue: todayOrderStats.revenue,
      },
      revenue: combinedRevenue,
      adhocPayments: {
        totalCollected: adhocPaymentStats.totalCollected,
        activeRequests: adhocPaymentStats.activeRequests,
        totalRequests: adhocPaymentStats.totalRequests,
        todayCollected: adhocPaymentStats.todayCollected,
        thisMonthCollected: adhocPaymentStats.thisMonthCollected,
      },
      menu: menuStats,
    };
  }

  /**
   * Get user statistics
   */
  private async getUserStats(todayStart: Date): Promise<DashboardStats['users']> {
    const [
      total,
      students,
      captains,
      owners,
      accountants,
      superadmins,
      pendingApproval,
      activeToday,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'captain' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'accountant' }),
      User.countDocuments({ role: 'superadmin' }),
      User.countDocuments({ isApproved: false, isActive: true }),
      User.countDocuments({ lastLoginAt: { $gte: todayStart } }),
    ]);

    return {
      total,
      students,
      captains,
      owners,
      accountants,
      superadmins,
      pendingApproval,
      activeToday,
    };
  }

  /**
   * Get shop statistics
   */
  private async getShopStats(): Promise<DashboardStats['shops']> {
    const [total, active] = await Promise.all([
      Shop.countDocuments({}),
      Shop.countDocuments({ isActive: true }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
    };
  }

  /**
   * Get order statistics by status (for dashboard)
   */
  private async getOrderStatusStats(): Promise<Omit<DashboardStats['orders'], 'todayCount' | 'todayRevenue'>> {
    const [total, pending, preparing, ready, completed, cancelled] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'preparing' }),
      Order.countDocuments({ status: 'ready' }),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({ status: 'cancelled' }),
    ]);

    return {
      total,
      pending,
      preparing,
      ready,
      completed,
      cancelled,
    };
  }

  /**
   * Get today's order statistics
   */
  private async getTodayOrderStats(todayStart: Date): Promise<{ count: number; revenue: number }> {
    const result = await Order.aggregate([
      {
        $match: {
          placedAt: { $gte: todayStart },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    return result[0] || { count: 0, revenue: 0 };
  }

  /**
   * Get order revenue statistics (renamed from getRevenueStats)
   */
  private async getOrderRevenueStats(
    todayStart: Date,
    weekStart: Date,
    monthStart: Date
  ): Promise<{ total: number; today: number; thisWeek: number; thisMonth: number }> {
    const [totalResult, todayResult, weekResult, monthResult] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    return {
      total: totalResult[0]?.total || 0,
      today: todayResult[0]?.total || 0,
      thisWeek: weekResult[0]?.total || 0,
      thisMonth: monthResult[0]?.total || 0,
    };
  }

  /**
   * Get ad-hoc payment statistics
   */
  private async getAdhocPaymentStats(
    todayStart: Date,
    monthStart: Date
  ): Promise<{
    totalCollected: number;
    activeRequests: number;
    totalRequests: number;
    todayCollected: number;
    thisWeekCollected: number;
    thisMonthCollected: number;
  }> {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalCollectedResult,
      todayCollectedResult,
      weekCollectedResult,
      monthCollectedResult,
      activeRequests,
      totalRequests,
    ] = await Promise.all([
      // Total collected from all paid submissions
      PaymentSubmission.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Today's collections
      PaymentSubmission.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // This week's collections
      PaymentSubmission.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // This month's collections
      PaymentSubmission.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Count of active payment requests
      PaymentRequest.countDocuments({ status: 'active' }),
      // Total payment requests
      PaymentRequest.countDocuments({}),
    ]);

    return {
      totalCollected: totalCollectedResult[0]?.total || 0,
      todayCollected: todayCollectedResult[0]?.total || 0,
      thisWeekCollected: weekCollectedResult[0]?.total || 0,
      thisMonthCollected: monthCollectedResult[0]?.total || 0,
      activeRequests,
      totalRequests,
    };
  }

  /**
   * Get menu statistics
   */
  private async getMenuStats(): Promise<DashboardStats['menu']> {
    const [totalItems, availableItems] = await Promise.all([
      FoodItem.countDocuments({}),
      FoodItem.countDocuments({ isAvailable: true }),
    ]);

    return {
      totalItems,
      availableItems,
    };
  }

  /**
   * Get all orders with pagination and filters
   */
  async getAllOrders(options: OrderQueryOptions): Promise<{
    orders: unknown[];
    pagination: PaginationResult;
  }> {
    const { page, limit, status, shopId } = options;
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};
    if (status) {
      query['status'] = status;
    }
    if (shopId) {
      query['shop'] = new Types.ObjectId(shopId);
    }

    // Get total count
    const total = await Order.countDocuments(query);

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate('user', 'name email phone rollNumber')
      .populate('shop', 'name')
      .sort({ placedAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get order statistics with optional date range (public API)
   */
  async getOrderStats(startDate?: Date, endDate?: Date): Promise<Record<string, unknown>> {
    const matchStage: Record<string, unknown> = {};

    if (startDate || endDate) {
      matchStage['placedAt'] = {};
      if (startDate) {
        (matchStage['placedAt'] as Record<string, Date>)['$gte'] = startDate;
      }
      if (endDate) {
        (matchStage['placedAt'] as Record<string, Date>)['$lte'] = endDate;
      }
    }

    const [statusStats, shopStats, dailyStats] = await Promise.all([
      // Stats by status
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$total' },
          },
        },
      ]),

      // Stats by shop
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$shop',
            count: { $sum: 1 },
            totalAmount: { $sum: '$total' },
          },
        },
        {
          $lookup: {
            from: 'shops',
            localField: '_id',
            foreignField: '_id',
            as: 'shopInfo',
          },
        },
        {
          $project: {
            shopId: '$_id',
            shopName: { $arrayElemAt: ['$shopInfo.name', 0] },
            count: 1,
            totalAmount: 1,
          },
        },
      ]),

      // Daily stats (last 7 days)
      Order.aggregate([
        {
          $match: {
            placedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$placedAt' },
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Transform status stats to object
    const byStatus: Record<string, { count: number; totalAmount: number }> = {};
    for (const stat of statusStats) {
      byStatus[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    }

    return {
      byStatus,
      byShop: shopStats,
      daily: dailyStats,
      summary: {
        totalOrders: statusStats.reduce((sum, s) => sum + s.count, 0),
        totalRevenue: statusStats.reduce((sum, s) => sum + s.totalAmount, 0),
      },
    };
  }

  // ============================================
  // OWNER-SHOP DIAGNOSTIC & FIX METHODS
  // ============================================

  /**
   * Get diagnostic information about owner-shop relationships
   */
  async diagnoseOwnerShopLinks(): Promise<{
    owners: Array<{
      id: string;
      name: string;
      email?: string;
      shopId: string | null;
      shopName: string | null;
      hasShopLinked: boolean;
    }>;
    shops: Array<{
      id: string;
      name: string;
      ownerId: string | null;
      ownerName: string | null;
      ownerEmail: string | null;
      hasOwnerLinked: boolean;
    }>;
    issues: Array<{
      type: 'owner_without_shop' | 'shop_without_owner' | 'mismatch';
      description: string;
      ownerId?: string;
      shopId?: string;
    }>;
  }> {
    // Get all owners with their shop info
    const owners = await User.find({ role: 'owner' })
      .populate('shop', 'name')
      .select('name email shop')
      .lean();

    // Get all shops with their owner info
    const shops = await Shop.find({})
      .populate('owner', 'name email')
      .select('name owner')
      .lean();

    const issues: Array<{
      type: 'owner_without_shop' | 'shop_without_owner' | 'mismatch';
      description: string;
      ownerId?: string;
      shopId?: string;
    }> = [];

    // Map owners
    const ownerResults = owners.map(owner => {
      const shop = owner.shop as unknown as { _id: Types.ObjectId; name: string } | null;
      const hasShopLinked = !!shop;

      if (!hasShopLinked) {
        issues.push({
          type: 'owner_without_shop',
          description: `Owner "${owner.name}" (${owner.email}) has no shop linked`,
          ownerId: owner._id.toString(),
        });
      }

      return {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        shopId: shop?._id?.toString() || null,
        shopName: shop?.name || null,
        hasShopLinked,
      };
    });

    // Map shops
    const shopResults = shops.map(shop => {
      const owner = shop.owner as unknown as { _id: Types.ObjectId; name: string; email: string } | null;
      const hasOwnerLinked = !!owner;

      if (!hasOwnerLinked) {
        issues.push({
          type: 'shop_without_owner',
          description: `Shop "${shop.name}" has no owner linked`,
          shopId: shop._id.toString(),
        });
      }

      return {
        id: shop._id.toString(),
        name: shop.name,
        ownerId: owner?._id?.toString() || null,
        ownerName: owner?.name || null,
        ownerEmail: owner?.email || null,
        hasOwnerLinked,
      };
    });

    // Check for mismatches (owner points to shop but shop doesn't point back)
    for (const owner of ownerResults) {
      if (owner.shopId) {
        const shop = shopResults.find(s => s.id === owner.shopId);
        if (shop && shop.ownerId !== owner.id) {
          issues.push({
            type: 'mismatch',
            description: `Owner "${owner.name}" points to shop "${shop.name}" but shop points to different owner`,
            ownerId: owner.id,
            shopId: shop.id,
          });
        }
      }
    }

    return {
      owners: ownerResults,
      shops: shopResults,
      issues,
    };
  }

  /**
   * Link an owner to a shop (fixes broken relationships)
   */
  async linkOwnerToShop(ownerId: string, shopId: string): Promise<{
    success: boolean;
    owner: { id: string; name: string; email?: string };
    shop: { id: string; name: string };
  }> {
    // Validate IDs
    if (!Types.ObjectId.isValid(ownerId) || !Types.ObjectId.isValid(shopId)) {
      throw new Error('Invalid owner or shop ID format');
    }

    // Find owner
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new Error('Owner not found');
    }
    if (owner.role !== 'owner') {
      throw new Error('User is not an owner');
    }

    // Find shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Update owner's shop reference
    owner.shop = new Types.ObjectId(shopId);
    await owner.save();

    // Update shop's owner reference
    shop.owner = new Types.ObjectId(ownerId);
    await shop.save();

    return {
      success: true,
      owner: {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
      },
      shop: {
        id: shop._id.toString(),
        name: shop.name,
      },
    };
  }
}

// Export singleton instance
export const superadminService = new SuperadminService();
export default superadminService;
