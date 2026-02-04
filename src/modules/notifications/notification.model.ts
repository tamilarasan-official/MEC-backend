import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Notification types
export const NOTIFICATION_TYPES = [
  'order_placed',
  'order_confirmed',
  'order_preparing',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'wallet_credit',
  'wallet_debit',
  'wallet_refund',
  'promotion',
  'announcement',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Reference types for linking notifications to other documents
export const REFERENCE_TYPES = ['order', 'transaction', 'shop', 'promotion', 'user'] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

// Base notification interface
export interface INotification {
  user: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  referenceType?: ReferenceType;
  referenceId?: Types.ObjectId;
  isRead: boolean;
  readAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface (includes Mongoose document methods)
export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
  markAsRead(): Promise<INotificationDocument>;
}

// Model interface for static methods
export interface INotificationModel extends Model<INotificationDocument> {
  findByUser(userId: Types.ObjectId, limit?: number): Promise<INotificationDocument[]>;
  findUnreadByUser(userId: Types.ObjectId): Promise<INotificationDocument[]>;
  getUnreadCount(userId: Types.ObjectId): Promise<number>;
  markAllAsRead(userId: Types.ObjectId): Promise<number>;
  createOrderNotification(
    userId: Types.ObjectId,
    type: NotificationType,
    orderId: Types.ObjectId,
    orderNumber: string
  ): Promise<INotificationDocument>;
  createWalletNotification(
    userId: Types.ObjectId,
    type: 'wallet_credit' | 'wallet_debit' | 'wallet_refund',
    amount: number,
    transactionId: Types.ObjectId
  ): Promise<INotificationDocument>;
  createBulkNotification(
    userIds: Types.ObjectId[],
    title: string,
    message: string,
    type: NotificationType,
    referenceType?: ReferenceType,
    referenceId?: Types.ObjectId
  ): Promise<INotificationDocument[]>;
}

// Notification Schema
const NotificationSchema = new Schema<INotificationDocument, INotificationModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    referenceType: {
      type: String,
      enum: {
        values: REFERENCE_TYPES,
        message: '{VALUE} is not a valid reference type',
      },
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: INotificationDocument, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for efficient querying
NotificationSchema.index({ user: 1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ referenceType: 1, referenceId: 1 });

// TTL index to auto-delete notifications after 30 days
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days in seconds
);

// Instance method to mark notification as read
NotificationSchema.methods.markAsRead = async function (
  this: INotificationDocument
): Promise<INotificationDocument> {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static methods
NotificationSchema.statics.findByUser = function (
  userId: Types.ObjectId,
  limit: number = 50
): Promise<INotificationDocument[]> {
  return this.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
};

NotificationSchema.statics.findUnreadByUser = function (
  userId: Types.ObjectId
): Promise<INotificationDocument[]> {
  return this.find({ user: userId, isRead: false }).sort({ createdAt: -1 });
};

NotificationSchema.statics.getUnreadCount = function (userId: Types.ObjectId): Promise<number> {
  return this.countDocuments({ user: userId, isRead: false });
};

NotificationSchema.statics.markAllAsRead = async function (userId: Types.ObjectId): Promise<number> {
  const result = await this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount;
};

NotificationSchema.statics.createOrderNotification = async function (
  userId: Types.ObjectId,
  type: NotificationType,
  orderId: Types.ObjectId,
  orderNumber: string
): Promise<INotificationDocument> {
  const notificationMessages: Record<string, { title: string; message: string }> = {
    order_placed: {
      title: 'Order Placed',
      message: `Your order #${orderNumber} has been placed successfully.`,
    },
    order_confirmed: {
      title: 'Order Confirmed',
      message: `Your order #${orderNumber} has been confirmed by the shop.`,
    },
    order_preparing: {
      title: 'Order Being Prepared',
      message: `Your order #${orderNumber} is now being prepared.`,
    },
    order_ready: {
      title: 'Order Ready!',
      message: `Your order #${orderNumber} is ready for pickup!`,
    },
    order_completed: {
      title: 'Order Completed',
      message: `Your order #${orderNumber} has been completed. Thank you!`,
    },
    order_cancelled: {
      title: 'Order Cancelled',
      message: `Your order #${orderNumber} has been cancelled.`,
    },
  };

  const { title, message } = notificationMessages[type] ?? {
    title: 'Order Update',
    message: `Your order #${orderNumber} has been updated.`,
  };

  const notification = new this({
    user: userId,
    title,
    message,
    type,
    referenceType: 'order',
    referenceId: orderId,
  });

  return notification.save();
};

NotificationSchema.statics.createWalletNotification = async function (
  userId: Types.ObjectId,
  type: 'wallet_credit' | 'wallet_debit' | 'wallet_refund',
  amount: number,
  transactionId: Types.ObjectId
): Promise<INotificationDocument> {
  const formattedAmount = `Rs. ${amount.toFixed(2)}`;

  const notificationMessages: Record<string, { title: string; message: string }> = {
    wallet_credit: {
      title: 'Wallet Credited',
      message: `${formattedAmount} has been added to your wallet.`,
    },
    wallet_debit: {
      title: 'Wallet Debited',
      message: `${formattedAmount} has been deducted from your wallet.`,
    },
    wallet_refund: {
      title: 'Refund Received',
      message: `${formattedAmount} has been refunded to your wallet.`,
    },
  };

  const msg = notificationMessages[type]!;

  const notification = new this({
    user: userId,
    title: msg.title,
    message: msg.message,
    type,
    referenceType: 'transaction' as ReferenceType,
    referenceId: transactionId,
  });

  return notification.save();
};

NotificationSchema.statics.createBulkNotification = async function (
  userIds: Types.ObjectId[],
  title: string,
  message: string,
  type: NotificationType,
  referenceType?: ReferenceType,
  referenceId?: Types.ObjectId
): Promise<INotificationDocument[]> {
  const notifications = userIds.map((userId) => ({
    user: userId,
    title,
    message,
    type,
    referenceType,
    referenceId,
    isRead: false,
  }));

  const result = await this.insertMany(notifications);
  return result as unknown as INotificationDocument[];
};

// Create and export the model
export const Notification = mongoose.model<INotificationDocument, INotificationModel>(
  'Notification',
  NotificationSchema
);

export default Notification;
