/**
 * Order Events
 * Socket.io event emitters for real-time order updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { IOrderDocument } from './order.model.js';
import { logger } from '../../config/logger.js';

// ============================================
// EVENT NAMES
// ============================================

export const ORDER_EVENTS = {
  // Events sent to shops
  NEW_ORDER: 'order:new',
  ORDER_CANCELLED: 'order:cancelled',

  // Events sent to users
  STATUS_CHANGE: 'order:status_changed',
  ORDER_READY: 'order:ready',
  ORDER_COMPLETED: 'order:completed',

  // Room names
  SHOP_ROOM: (shopId: string) => `shop:${shopId}`,
  USER_ROOM: (userId: string) => `user:${userId}`,
} as const;

// ============================================
// ORDER EVENTS CLASS
// ============================================

export class OrderEvents {
  private io: SocketIOServer | null = null;

  /**
   * Initialize with Socket.io server instance
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupEventHandlers();
    logger.info('Order events initialized');
  }

  /**
   * Set up socket event handlers for order-related rooms
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      // Join shop room (for captains/owners)
      socket.on('join:shop', (shopId: string) => {
        if (!shopId) return;
        const room = ORDER_EVENTS.SHOP_ROOM(shopId);
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined shop room: ${room}`);
      });

      // Leave shop room
      socket.on('leave:shop', (shopId: string) => {
        if (!shopId) return;
        const room = ORDER_EVENTS.SHOP_ROOM(shopId);
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left shop room: ${room}`);
      });

      // Join user room (for students)
      socket.on('join:user', (userId: string) => {
        if (!userId) return;
        const room = ORDER_EVENTS.USER_ROOM(userId);
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined user room: ${room}`);
      });

      // Leave user room
      socket.on('leave:user', (userId: string) => {
        if (!userId) return;
        const room = ORDER_EVENTS.USER_ROOM(userId);
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left user room: ${room}`);
      });
    });
  }

  /**
   * Emit new order event to shop room
   */
  emitNewOrder(shopId: string, order: IOrderDocument): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit new order event');
      return;
    }

    const room = ORDER_EVENTS.SHOP_ROOM(shopId);
    const payload = this.formatOrderPayload(order);

    this.io.to(room).emit(ORDER_EVENTS.NEW_ORDER, payload);
    logger.debug(`Emitted new order event to room ${room}`, { orderId: order._id });
  }

  /**
   * Emit order status change to user
   */
  emitStatusChange(userId: string, order: IOrderDocument): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit status change event');
      return;
    }

    const room = ORDER_EVENTS.USER_ROOM(userId);
    const payload = this.formatOrderPayload(order);

    this.io.to(room).emit(ORDER_EVENTS.STATUS_CHANGE, payload);
    logger.debug(`Emitted status change event to room ${room}`, {
      orderId: order._id,
      status: order.status,
    });

    // Also emit to shop room
    const shopRoom = ORDER_EVENTS.SHOP_ROOM(order.shop.toString());
    this.io.to(shopRoom).emit(ORDER_EVENTS.STATUS_CHANGE, payload);
  }

  /**
   * Emit order ready notification to user
   */
  emitOrderReady(userId: string, order: IOrderDocument): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit order ready event');
      return;
    }

    const room = ORDER_EVENTS.USER_ROOM(userId);
    const payload = {
      ...this.formatOrderPayload(order),
      notification: {
        title: 'Order Ready!',
        body: `Your order ${order.orderNumber} is ready for pickup. Show your QR code at the counter.`,
        type: 'order_ready',
      },
    };

    this.io.to(room).emit(ORDER_EVENTS.ORDER_READY, payload);
    logger.debug(`Emitted order ready event to room ${room}`, { orderId: order._id });
  }

  /**
   * Emit order completed notification
   */
  emitOrderCompleted(userId: string, order: IOrderDocument): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit order completed event');
      return;
    }

    const room = ORDER_EVENTS.USER_ROOM(userId);
    const payload = {
      ...this.formatOrderPayload(order),
      notification: {
        title: 'Order Completed',
        body: `Your order ${order.orderNumber} has been completed. Thank you for ordering!`,
        type: 'order_completed',
      },
    };

    this.io.to(room).emit(ORDER_EVENTS.ORDER_COMPLETED, payload);
    logger.debug(`Emitted order completed event to room ${room}`, { orderId: order._id });
  }

  /**
   * Emit order cancelled notification
   */
  emitOrderCancelled(userId: string, shopId: string, order: IOrderDocument): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit order cancelled event');
      return;
    }

    // Notify user
    const userRoom = ORDER_EVENTS.USER_ROOM(userId);
    const payload = {
      ...this.formatOrderPayload(order),
      notification: {
        title: 'Order Cancelled',
        body: `Your order ${order.orderNumber} has been cancelled.${order.cancellationReason ? ` Reason: ${order.cancellationReason}` : ''} Amount has been refunded to your wallet.`,
        type: 'order_cancelled',
      },
    };

    this.io.to(userRoom).emit(ORDER_EVENTS.ORDER_CANCELLED, payload);

    // Notify shop
    const shopRoom = ORDER_EVENTS.SHOP_ROOM(shopId);
    this.io.to(shopRoom).emit(ORDER_EVENTS.ORDER_CANCELLED, this.formatOrderPayload(order));

    logger.debug(`Emitted order cancelled event`, { orderId: order._id });
  }

  /**
   * Format order payload for socket emission
   */
  private formatOrderPayload(order: IOrderDocument): Record<string, unknown> {
    return {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      pickupToken: order.pickupToken,
      itemCount: order.items.length,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      placedAt: order.placedAt,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      user: order.user,
      shop: order.shop,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the number of connections in a room
   */
  async getRoomSize(roomName: string): Promise<number> {
    if (!this.io) return 0;
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.length;
  }

  /**
   * Check if socket.io is initialized
   */
  isInitialized(): boolean {
    return this.io !== null;
  }
}

// Export singleton instance
export const orderEvents = new OrderEvents();

export default orderEvents;
