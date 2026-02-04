/**
 * Superadmin Service
 * Business logic for superadmin dashboard and management
 */

import { Types } from 'mongoose';
import { User } from '../users/user.model.js';
import { Shop } from '../shops/shop.model.js';
import { Order } from '../orders/order.model.js';

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
      revenueStats,
    ] = await Promise.all([
      this.getUserStats(todayStart),
      this.getShopStats(),
      this.getOrderStatusStats(),
      this.getTodayOrderStats(todayStart),
      this.getRevenueStats(todayStart, weekStart, monthStart),
    ]);

    return {
      users: userStats,
      shops: shopStats,
      orders: {
        ...orderStatusStats,
        todayCount: todayOrderStats.count,
        todayRevenue: todayOrderStats.revenue,
      },
      revenue: revenueStats,
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
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    return result[0] || { count: 0, revenue: 0 };
  }

  /**
   * Get revenue statistics
   */
  private async getRevenueStats(
    todayStart: Date,
    weekStart: Date,
    monthStart: Date
  ): Promise<DashboardStats['revenue']> {
    const [totalResult, todayResult, weekResult, monthResult] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
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
            totalAmount: { $sum: '$totalAmount' },
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
            totalAmount: { $sum: '$totalAmount' },
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
            totalAmount: { $sum: '$totalAmount' },
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
}

// Export singleton instance
export const superadminService = new SuperadminService();
export default superadminService;
