/**
 * Order Service
 * Business logic for order management with MongoDB transactions
 */

import mongoose, { Types, ClientSession } from 'mongoose';
import { Order, IOrderDocument, OrderStatus, ORDER_STATUS_TRANSITIONS, IOrderItem } from './order.model.js';
import { User, IUserDocument } from '../users/user.model.js';
import { FoodItem, IFoodItemDocument } from '../menu/food-item.model.js';
import { Transaction } from '../wallet/transaction.model.js';
import { CreateOrderInput, OrderQueryInput } from './order.validation.js';
import { AppError } from '../../shared/middleware/error.middleware.js';
import { HttpStatus, PaginationConfig } from '../../config/constants.js';
import { PaginationMeta } from '../../shared/types/index.js';

// ============================================
// TYPES
// ============================================

export interface OrderResult {
  order: IOrderDocument;
  qrData: string;
}

export interface PaginatedOrders {
  orders: IOrderDocument[];
  pagination: PaginationMeta;
}

export interface QrPayload {
  order_id: string;
  pickup_token: string;
  shop_id: string;
  timestamp: number;
}

// ============================================
// QR CODE UTILITIES
// ============================================

/**
 * Generate QR data as base64 encoded JSON
 */
function generateQrData(orderId: string, pickupToken: string, shopId: string): string {
  const payload: QrPayload = {
    order_id: orderId,
    pickup_token: pickupToken,
    shop_id: shopId,
    timestamp: Date.now(),
  };

  // Base64 encode the JSON
  const jsonString = JSON.stringify(payload);
  return Buffer.from(jsonString).toString('base64');
}

/**
 * Decode QR data from base64
 */
function decodeQrData(qrData: string): QrPayload | null {
  try {
    const jsonString = Buffer.from(qrData, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonString) as QrPayload;

    // Validate required fields
    if (!payload.order_id || !payload.pickup_token || !payload.shop_id) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================
// ORDER SERVICE CLASS
// ============================================

export class OrderService {
  /**
   * Create a new order with transaction
   */
  async createOrder(userId: string, data: CreateOrderInput): Promise<OrderResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate user exists and is active
      const user = await User.findOne({
        _id: userId,
        isActive: true,
        role: 'student',
      }).session(session);

      if (!user) {
        throw AppError.notFound('User not found or not active');
      }

      // 2. Get and validate all food items
      const foodItemIds = data.items.map((item) => new Types.ObjectId(item.foodItemId));
      const foodItems = await FoodItem.find({
        _id: { $in: foodItemIds },
        shop: new Types.ObjectId(data.shopId),
        isAvailable: true,
      }).session(session);

      if (foodItems.length !== data.items.length) {
        const foundIds = foodItems.map((fi) => fi._id.toString());
        const missingIds = data.items
          .filter((item) => !foundIds.includes(item.foodItemId))
          .map((item) => item.foodItemId);

        throw AppError.badRequest(`Some food items are not available or not found`, 'ITEMS_NOT_AVAILABLE', {
          missingIds,
        });
      }

      // 3. Create food item map for quick lookup
      const foodItemMap = new Map<string, IFoodItemDocument>();
      for (const item of foodItems) {
        foodItemMap.set(item._id.toString(), item);
      }

      // 4. Calculate total and build order items with snapshot
      let total = 0;
      const orderItems: IOrderItem[] = [];

      for (const item of data.items) {
        const foodItem = foodItemMap.get(item.foodItemId)!;
        const effectivePrice = foodItem.isOfferActive && foodItem.offerPrice
          ? foodItem.offerPrice
          : foodItem.price;
        const subtotal = effectivePrice * item.quantity;

        total += subtotal;

        const orderItem: IOrderItem = {
          foodItem: foodItem._id,
          name: foodItem.name,
          price: foodItem.price,
          quantity: item.quantity,
          subtotal,
          imageUrl: foodItem.imageUrl,
          category: foodItem.category,
        };

        // Only add offerPrice if it exists
        if (foodItem.offerPrice !== undefined) {
          orderItem.offerPrice = foodItem.offerPrice;
        }

        orderItems.push(orderItem);
      }

      // 5. Check user balance
      if (user.balance < total) {
        throw new AppError(
          `Insufficient balance. Required: ${total}, Available: ${user.balance}`,
          HttpStatus.BAD_REQUEST,
          'INSUFFICIENT_BALANCE',
          true,
          { required: total, available: user.balance }
        );
      }

      // 6. Generate order number and pickup token
      const orderNumber = await Order.generateOrderNumber();
      const pickupToken = Order.generatePickupToken();

      // 7. Create temporary ObjectId for QR data (needed before saving)
      const orderId = new Types.ObjectId();

      // 8. Generate QR data
      const qrData = generateQrData(orderId.toString(), pickupToken, data.shopId);

      // 9. Deduct user balance
      const balanceBefore = user.balance;
      user.balance -= total;
      await user.save({ session });

      // 10. Create the order
      const order = new Order({
        _id: orderId,
        orderNumber,
        user: new Types.ObjectId(userId),
        shop: new Types.ObjectId(data.shopId),
        items: orderItems,
        total,
        status: 'pending',
        notes: data.notes,
        pickupToken,
        qrData,
        placedAt: new Date(),
      });

      await order.save({ session });

      // 11. Create transaction record
      const transaction = new Transaction({
        user: new Types.ObjectId(userId),
        type: 'debit',
        amount: total,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Order payment - ${orderNumber}`,
        status: 'completed',
        order: orderId,
      });

      await transaction.save({ session });

      // 12. Commit transaction
      await session.commitTransaction();

      // 13. Populate and return order
      const populatedOrder = await Order.findById(orderId)
        .populate('user', 'name email phone')
        .populate('shop', 'name')
        .populate('items.foodItem', 'name imageUrl');

      return {
        order: populatedOrder!,
        qrData,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId?: string): Promise<IOrderDocument> {
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone rollNumber')
      .populate('shop', 'name location')
      .populate('handledBy', 'name')
      .populate('items.foodItem', 'name imageUrl');

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Check ownership if userId provided
    if (userId && order.user._id.toString() !== userId) {
      throw AppError.forbidden('You do not have access to this order');
    }

    return order;
  }

  /**
   * Get orders for a user with pagination and filters
   */
  async getUserOrders(userId: string, filters: OrderQueryInput): Promise<PaginatedOrders> {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = { user: new Types.ObjectId(userId) };

    if (status) {
      query['status'] = status;
    }

    if (startDate || endDate) {
      query['placedAt'] = {};
      if (startDate) {
        (query['placedAt'] as Record<string, Date>)['$gte'] = new Date(startDate);
      }
      if (endDate) {
        (query['placedAt'] as Record<string, Date>)['$lte'] = new Date(endDate);
      }
    }

    // Execute query with pagination
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('shop', 'name')
        .populate('items.foodItem', 'name imageUrl')
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

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
   * Get orders for a shop with pagination and filters
   * If shopId is undefined, returns orders from all shops (for superadmin)
   */
  async getShopOrders(shopId: string | undefined, filters: OrderQueryInput): Promise<PaginatedOrders> {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    // Build query - filter by shop if shopId provided
    const query: Record<string, unknown> = {};
    if (shopId) {
      query['shop'] = new Types.ObjectId(shopId);
    }

    if (status) {
      query['status'] = status;
    }

    if (startDate || endDate) {
      query['placedAt'] = {};
      if (startDate) {
        (query['placedAt'] as Record<string, Date>)['$gte'] = new Date(startDate);
      }
      if (endDate) {
        (query['placedAt'] as Record<string, Date>)['$lte'] = new Date(endDate);
      }
    }

    // Execute query with pagination
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone rollNumber')
        .populate('handledBy', 'name')
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

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
   * Update order status with validation and potential refund
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    handledBy: string,
    reason?: string
  ): Promise<IOrderDocument> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw AppError.notFound('Order not found');
      }

      // Validate status transition
      const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status];
      if (!allowedTransitions.includes(newStatus)) {
        throw new AppError(
          `Cannot transition from ${order.status} to ${newStatus}`,
          HttpStatus.BAD_REQUEST,
          'INVALID_STATUS_TRANSITION',
          true,
          { currentStatus: order.status, allowedTransitions }
        );
      }

      // Handle cancellation with refund
      if (newStatus === 'cancelled') {
        // Only refund if cancelling from pending or preparing
        if (['pending', 'preparing'].includes(order.status)) {
          await this.processRefund(order, handledBy, reason, session);
        }

        if (reason) {
          order.cancellationReason = reason;
        }
        order.cancelledAt = new Date();
      }

      // Update status timestamps
      switch (newStatus) {
        case 'preparing':
          order.preparingAt = new Date();
          break;
        case 'ready':
          order.readyAt = new Date();
          break;
        case 'completed':
          order.completedAt = new Date();
          break;
      }

      order.status = newStatus;
      order.handledBy = new Types.ObjectId(handledBy);

      await order.save({ session });
      await session.commitTransaction();

      // Return populated order
      return await Order.findById(orderId)
        .populate('user', 'name email phone')
        .populate('shop', 'name')
        .populate('handledBy', 'name') as IOrderDocument;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process refund for cancelled order
   */
  private async processRefund(
    order: IOrderDocument,
    processedBy: string,
    reason: string | undefined,
    session: ClientSession
  ): Promise<void> {
    const user = await User.findById(order.user).session(session);

    if (!user) {
      throw AppError.notFound('User not found for refund');
    }

    const balanceBefore = user.balance;
    user.balance += order.total;
    await user.save({ session });

    // Create refund transaction
    const transaction = new Transaction({
      user: order.user,
      type: 'refund',
      amount: order.total,
      balanceBefore,
      balanceAfter: user.balance,
      description: `Refund for cancelled order ${order.orderNumber}${reason ? `: ${reason}` : ''}`,
      status: 'completed',
      order: order._id,
      processedBy: new Types.ObjectId(processedBy),
      source: 'refund',
    });

    await transaction.save({ session });
  }

  /**
   * Verify QR code for order pickup
   */
  async verifyQr(qrData: string, shopId: string): Promise<IOrderDocument> {
    const payload = decodeQrData(qrData);

    if (!payload) {
      throw AppError.badRequest('Invalid QR code data', 'INVALID_QR_DATA');
    }

    // Validate shop matches
    if (payload.shop_id !== shopId) {
      throw AppError.badRequest('QR code does not match this shop', 'SHOP_MISMATCH');
    }

    // Find the order
    const order = await Order.findById(payload.order_id)
      .populate('user', 'name email phone rollNumber')
      .populate('shop', 'name');

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Verify pickup token
    if (order.pickupToken !== payload.pickup_token) {
      throw AppError.badRequest('Invalid pickup token', 'INVALID_PICKUP_TOKEN');
    }

    // Check order status
    if (order.status !== 'ready') {
      throw new AppError(
        `Order is not ready for pickup. Current status: ${order.status}`,
        HttpStatus.BAD_REQUEST,
        'ORDER_NOT_READY',
        true,
        { currentStatus: order.status }
      );
    }

    return order;
  }

  /**
   * Complete an order (mark as picked up)
   */
  async completeOrder(orderId: string, handledBy: string): Promise<IOrderDocument> {
    return this.updateOrderStatus(orderId, 'completed', handledBy);
  }

  /**
   * Cancel an order (student only - from pending status)
   */
  async cancelOrderByStudent(orderId: string, userId: string, reason?: string): Promise<IOrderDocument> {
    const order = await Order.findById(orderId);

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Verify ownership
    if (order.user.toString() !== userId) {
      throw AppError.forbidden('You do not have access to this order');
    }

    // Students can only cancel pending orders
    if (order.status !== 'pending') {
      throw new AppError(
        'You can only cancel orders that are still pending',
        HttpStatus.BAD_REQUEST,
        'CANNOT_CANCEL',
        true,
        { currentStatus: order.status }
      );
    }

    return this.updateOrderStatus(orderId, 'cancelled', userId, reason);
  }

  /**
   * Get active orders for a shop (pending, preparing, ready)
   * If shopId is undefined, returns active orders from all shops (for superadmin)
   */
  async getActiveShopOrders(shopId: string | undefined): Promise<IOrderDocument[]> {
    const query: Record<string, unknown> = {
      status: { $in: ['pending', 'preparing', 'ready'] },
    };
    if (shopId) {
      query['shop'] = new Types.ObjectId(shopId);
    }
    return Order.find(query)
      .populate('user', 'name phone rollNumber')
      .populate('shop', 'name')
      .sort({ placedAt: 1 });
  }

  /**
   * Get order statistics for a shop
   * If shopId is undefined, returns stats for all shops (for superadmin)
   */
  async getShopOrderStats(shopId: string | undefined, startDate?: Date, endDate?: Date): Promise<Record<string, unknown>> {
    const matchStage: Record<string, unknown> = {};
    if (shopId) {
      matchStage['shop'] = new Types.ObjectId(shopId);
    }

    if (startDate || endDate) {
      matchStage['placedAt'] = {};
      if (startDate) {
        (matchStage['placedAt'] as Record<string, Date>)['$gte'] = startDate;
      }
      if (endDate) {
        (matchStage['placedAt'] as Record<string, Date>)['$lte'] = endDate;
      }
    }

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
        },
      },
    ]);

    // Format results
    const result: Record<string, { count: number; revenue: number }> = {};
    let totalOrders = 0;
    let totalRevenue = 0;

    for (const stat of stats) {
      result[stat._id] = {
        count: stat.count,
        revenue: stat.totalRevenue,
      };
      totalOrders += stat.count;
      if (stat._id === 'completed') {
        totalRevenue += stat.totalRevenue;
      }
    }

    return {
      byStatus: result,
      totalOrders,
      totalRevenue,
    };
  }

  /**
   * Get analytics data for a shop
   * If shopId is undefined, returns analytics for all shops (for superadmin)
   */
  async getShopAnalytics(shopId: string | undefined): Promise<Record<string, unknown>> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Base match for shop
    const shopMatch: Record<string, unknown> = {};
    if (shopId) {
      shopMatch['shop'] = new Types.ObjectId(shopId);
    }

    // Get this month's completed orders
    const thisMonthOrders = await Order.find({
      ...shopMatch,
      status: 'completed',
      completedAt: { $gte: thisMonthStart },
    });

    // Get last month's completed orders
    const lastMonthOrders = await Order.find({
      ...shopMatch,
      status: 'completed',
      completedAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    });

    // Get all completed orders for top items
    const allCompletedOrders = await Order.find({
      ...shopMatch,
      status: 'completed',
    });

    // Calculate this month stats
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + o.total, 0);
    const thisMonthProfit = thisMonthOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        const costPrice = item.price * 0.6; // Assume 40% margin
        const sellPrice = item.offerPrice || item.price;
        return itemSum + ((sellPrice - costPrice) * item.quantity);
      }, 0);
    }, 0);

    // Calculate last month stats
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + o.total, 0);

    // Calculate growth
    const revenueGrowth = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : (thisMonthRevenue > 0 ? 100 : 0);

    // Unique customers
    const uniqueCustomerIds = new Set(allCompletedOrders.map(o => o.user.toString()));
    const uniqueCustomers = uniqueCustomerIds.size;

    // Average order value
    const avgOrderValue = allCompletedOrders.length > 0
      ? Math.round(allCompletedOrders.reduce((sum, o) => sum + o.total, 0) / allCompletedOrders.length)
      : 0;

    // Profit margin
    const profitMargin = thisMonthRevenue > 0
      ? Math.round((thisMonthProfit / thisMonthRevenue) * 100)
      : 0;

    // Top selling items
    const itemSales: Record<string, { id: string; name: string; quantity: number; revenue: number }> = {};
    allCompletedOrders.forEach(order => {
      order.items.forEach(item => {
        const itemId = item.foodItem?.toString() || item.name;
        if (!itemSales[itemId]) {
          itemSales[itemId] = { id: itemId, name: item.name, quantity: 0, revenue: 0 };
        }
        itemSales[itemId].quantity += item.quantity;
        itemSales[itemId].revenue += (item.offerPrice || item.price) * item.quantity;
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      thisMonthRevenue,
      thisMonthProfit: Math.round(thisMonthProfit),
      thisMonthOrders: thisMonthOrders.length,
      lastMonthRevenue,
      revenueGrowth,
      uniqueCustomers,
      avgOrderValue,
      totalCompletedOrders: allCompletedOrders.length,
      profitMargin,
      topItems,
    };
  }
}

// Export singleton instance
export const orderService = new OrderService();

export default orderService;
