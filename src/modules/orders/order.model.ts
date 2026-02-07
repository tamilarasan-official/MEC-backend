import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Order status types
export const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'partially_delivered', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Payment status types
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['partially_delivered', 'completed', 'cancelled'],
  partially_delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Order item interface (snapshot of food item at time of order)
export interface IOrderItem {
  foodItem: Types.ObjectId;
  name: string;
  price: number;
  offerPrice?: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
  category?: string;
  delivered?: boolean;
}

// Service types
export const SERVICE_TYPES = ['food', 'laundry', 'xerox'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

// Laundry clothing categories
export const LAUNDRY_CATEGORIES = ['regular', 'delicates', 'denim', 'woolen', 'shoes', 'bedding', 'curtains'] as const;
export type LaundryCategory = (typeof LAUNDRY_CATEGORIES)[number];

// Laundry item in service details
export interface ILaundryItem {
  category: LaundryCategory;
  count: number;
  pricePerItem: number;
}

// Xerox paper sizes
export const XEROX_PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'] as const;
export type XeroxPaperSize = (typeof XEROX_PAPER_SIZES)[number];

// Service details for laundry/xerox orders
export interface IServiceDetails {
  type: ServiceType;
  // Laundry specific
  laundry?: {
    items: ILaundryItem[];
    totalClothes: number;
    specialInstructions?: string;
  };
  // Xerox specific
  xerox?: {
    pageCount: number;
    copies: number;
    colorType: 'bw' | 'color';
    paperSize: XeroxPaperSize;
    doubleSided: boolean;
    specialInstructions?: string;
  };
}

// Order interface
export interface IOrder {
  orderNumber: string;
  user: Types.ObjectId;
  shop: Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes?: string;

  // Service type (food, laundry, xerox)
  serviceType: ServiceType;
  serviceDetails?: IServiceDetails;

  // Pickup details
  pickupToken: string;
  qrData: string;

  // Tracking
  handledBy?: Types.ObjectId;
  cancellationReason?: string;

  // Timestamps
  placedAt: Date;
  preparingAt?: Date;
  readyAt?: Date;
  partiallyDeliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface IOrderDocument extends IOrder, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface IOrderModel extends Model<IOrderDocument> {
  findByOrderNumber(orderNumber: string): Promise<IOrderDocument | null>;
  findByPickupToken(pickupToken: string, shopId: Types.ObjectId): Promise<IOrderDocument | null>;
  generateOrderNumber(): Promise<string>;
  generatePickupToken(): string;
}

// Order Item Schema
const OrderItemSchema = new Schema<IOrderItem>(
  {
    foodItem: {
      type: Schema.Types.ObjectId,
      ref: 'FoodItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    offerPrice: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
    },
    category: {
      type: String,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Order Schema
const OrderSchema = new Schema<IOrderDocument, IOrderModel>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop is required'],
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      default: [],
      // Note: For food orders, items are required. For laundry/xerox, serviceDetails is used instead.
      // Validation is done at the service level.
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: '{VALUE} is not a valid order status',
      },
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },

    // Service type (food, laundry, xerox)
    serviceType: {
      type: String,
      enum: {
        values: SERVICE_TYPES,
        message: '{VALUE} is not a valid service type',
      },
      default: 'food',
      index: true,
    },

    // Service details for laundry/xerox
    serviceDetails: {
      type: {
        type: String,
        enum: SERVICE_TYPES,
      },
      laundry: {
        items: [{
          category: {
            type: String,
            enum: LAUNDRY_CATEGORIES,
          },
          count: Number,
          pricePerItem: Number,
        }],
        totalClothes: Number,
        specialInstructions: String,
      },
      xerox: {
        pageCount: Number,
        copies: Number,
        colorType: {
          type: String,
          enum: ['bw', 'color'],
        },
        paperSize: {
          type: String,
          enum: XEROX_PAPER_SIZES,
        },
        doubleSided: Boolean,
        specialInstructions: String,
      },
    },

    // Pickup details
    pickupToken: {
      type: String,
      required: true,
      index: true,
    },
    qrData: {
      type: String,
      required: true,
    },

    // Tracking
    handledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },

    // Timestamps
    placedAt: {
      type: Date,
      default: Date.now,
    },
    preparingAt: {
      type: Date,
    },
    readyAt: {
      type: Date,
    },
    partiallyDeliveredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes
OrderSchema.index({ user: 1, status: 1 });
OrderSchema.index({ shop: 1, status: 1 });
OrderSchema.index({ shop: 1, createdAt: -1 });
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ pickupToken: 1, shop: 1 });

// Static methods
OrderSchema.statics.findByOrderNumber = function (orderNumber: string): Promise<IOrderDocument | null> {
  return this.findOne({ orderNumber });
};

OrderSchema.statics.findByPickupToken = function (
  pickupToken: string,
  shopId: Types.ObjectId
): Promise<IOrderDocument | null> {
  return this.findOne({ pickupToken, shop: shopId });
};

OrderSchema.statics.generateOrderNumber = async function (): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Find the highest order number for today
  const lastOrder = await this.findOne({
    orderNumber: { $regex: `^ORD-${dateStr}-` },
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const parts = lastOrder.orderNumber.split('-');
    if (parts[2]) {
      const lastSequence = parseInt(parts[2], 10);
      sequence = lastSequence + 1;
    }
  }

  return `ORD-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

OrderSchema.statics.generatePickupToken = function (): string {
  // Generate 4-digit random token
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Create and export the model
export const Order = mongoose.model<IOrderDocument, IOrderModel>('Order', OrderSchema);

export default Order;
