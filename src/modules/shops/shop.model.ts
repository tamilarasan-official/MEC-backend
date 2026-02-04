import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Shop category types
export const SHOP_CATEGORIES = ['canteen', 'laundry', 'xerox', 'other'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

// Operating hours interface
export interface IOperatingHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  openTime: string; // HH:mm format
  closeTime: string; // HH:mm format
  isClosed: boolean;
}

// Shop interface
export interface IShop {
  name: string;
  description?: string;
  category: ShopCategory;
  owner?: Types.ObjectId;
  imageUrl?: string;
  bannerUrl?: string;
  operatingHours: IOperatingHours[];
  contactPhone?: string;
  isActive: boolean;
  rating: number;
  totalRatings: number;
  totalOrders: number;
  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface IShopDocument extends IShop, Document {
  _id: Types.ObjectId;
}

// Model interface
export interface IShopModel extends Model<IShopDocument> {
  findActiveShops(): Promise<IShopDocument[]>;
  findByOwner(ownerId: Types.ObjectId): Promise<IShopDocument | null>;
}

// Operating hours schema
const OperatingHoursSchema = new Schema<IOperatingHours>(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    openTime: {
      type: String,
      default: '08:00',
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:mm'],
    },
    closeTime: {
      type: String,
      default: '20:00',
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:mm'],
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Shop schema
const ShopSchema = new Schema<IShopDocument, IShopModel>(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      minlength: [2, 'Shop name must be at least 2 characters'],
      maxlength: [100, 'Shop name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      enum: {
        values: SHOP_CATEGORIES,
        message: '{VALUE} is not a valid shop category',
      },
      required: [true, 'Shop category is required'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    bannerUrl: {
      type: String,
      trim: true,
    },
    operatingHours: {
      type: [OperatingHoursSchema],
      default: [
        { day: 'monday', openTime: '08:00', closeTime: '20:00', isClosed: false },
        { day: 'tuesday', openTime: '08:00', closeTime: '20:00', isClosed: false },
        { day: 'wednesday', openTime: '08:00', closeTime: '20:00', isClosed: false },
        { day: 'thursday', openTime: '08:00', closeTime: '20:00', isClosed: false },
        { day: 'friday', openTime: '08:00', closeTime: '20:00', isClosed: false },
        { day: 'saturday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'sunday', openTime: '08:00', closeTime: '18:00', isClosed: true },
      ],
    },
    contactPhone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: IShopDocument, ret: Record<string, unknown>) => {
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
// Note: owner already has sparse index from schema definition
ShopSchema.index({ name: 1 });
ShopSchema.index({ category: 1 });
ShopSchema.index({ isActive: 1 });
ShopSchema.index({ rating: -1 });

// Static methods
ShopSchema.statics.findActiveShops = function (): Promise<IShopDocument[]> {
  return this.find({ isActive: true }).sort({ rating: -1 });
};

ShopSchema.statics.findByOwner = function (ownerId: Types.ObjectId): Promise<IShopDocument | null> {
  return this.findOne({ owner: ownerId });
};

// Create and export the model
export const Shop = mongoose.model<IShopDocument, IShopModel>('Shop', ShopSchema);

export default Shop;
