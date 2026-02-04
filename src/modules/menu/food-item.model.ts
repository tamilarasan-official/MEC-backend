import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Base food item interface
export interface IFoodItem {
  shop: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  costPrice?: number;
  isAvailable: boolean;
  isVegetarian: boolean;
  preparationTime: number; // in minutes

  // Rating fields
  rating: number;
  totalRatings: number;

  // Offer fields
  isOffer: boolean;
  offerPrice?: number;
  offerStartDate?: Date;
  offerEndDate?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface (includes Mongoose document methods)
export interface IFoodItemDocument extends IFoodItem, Document {
  _id: Types.ObjectId;
  effectivePrice: number; // Virtual field
  isOfferActive: boolean; // Virtual field
  profitMargin: number | null; // Virtual field
}

// Model interface for static methods
export interface IFoodItemModel extends Model<IFoodItemDocument> {
  findByShop(shopId: Types.ObjectId): Promise<IFoodItemDocument[]>;
  findByCategory(categoryId: Types.ObjectId): Promise<IFoodItemDocument[]>;
  findAvailableByShop(shopId: Types.ObjectId): Promise<IFoodItemDocument[]>;
  findActiveOffers(shopId?: Types.ObjectId): Promise<IFoodItemDocument[]>;
  updateRating(itemId: Types.ObjectId, newRating: number): Promise<IFoodItemDocument | null>;
}

// Food Item Schema
const FoodItemSchema = new Schema<IFoodItemDocument, IFoodItemModel>(
  {
    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop reference is required'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Food item name is required'],
      trim: true,
      minlength: [2, 'Food item name must be at least 2 characters'],
      maxlength: [100, 'Food item name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative'],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    preparationTime: {
      type: Number,
      default: 15,
      min: [1, 'Preparation time must be at least 1 minute'],
      max: [180, 'Preparation time cannot exceed 180 minutes'],
    },

    // Rating fields
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: [0, 'Total ratings cannot be negative'],
    },

    // Offer fields
    isOffer: {
      type: Boolean,
      default: false,
    },
    offerPrice: {
      type: Number,
      min: [0, 'Offer price cannot be negative'],
    },
    offerStartDate: {
      type: Date,
    },
    offerEndDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: IFoodItemDocument, ret: Record<string, unknown>) => {
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
FoodItemSchema.index({ shop: 1 });
FoodItemSchema.index({ category: 1 });
FoodItemSchema.index({ isAvailable: 1 });
FoodItemSchema.index({ isOffer: 1 });
FoodItemSchema.index({ shop: 1, category: 1 });
FoodItemSchema.index({ shop: 1, isAvailable: 1 });
FoodItemSchema.index({ shop: 1, isOffer: 1, offerStartDate: 1, offerEndDate: 1 });
FoodItemSchema.index({ name: 'text', description: 'text' }); // Text search index
FoodItemSchema.index({ rating: -1 }); // For sorting by rating

// Virtual for checking if offer is currently active
FoodItemSchema.virtual('isOfferActive').get(function (): boolean {
  if (!this.isOffer || !this.offerPrice) {
    return false;
  }

  const now = new Date();

  // If no date range specified, offer is active
  if (!this.offerStartDate && !this.offerEndDate) {
    return true;
  }

  // Check date range
  const startOk = !this.offerStartDate || now >= this.offerStartDate;
  const endOk = !this.offerEndDate || now <= this.offerEndDate;

  return startOk && endOk;
});

// Virtual for effective price (offer price if active, otherwise regular price)
FoodItemSchema.virtual('effectivePrice').get(function (): number {
  if (this.isOfferActive && this.offerPrice !== undefined) {
    return this.offerPrice;
  }
  return this.price;
});

// Virtual for profit margin calculation
FoodItemSchema.virtual('profitMargin').get(function (): number | null {
  if (!this.costPrice || this.costPrice === 0) {
    return null;
  }
  return ((this.price - this.costPrice) / this.price) * 100;
});

// Static methods
FoodItemSchema.statics.findByShop = function (shopId: Types.ObjectId): Promise<IFoodItemDocument[]> {
  return this.find({ shop: shopId })
    .populate('category', 'name icon')
    .sort({ category: 1, name: 1 });
};

FoodItemSchema.statics.findByCategory = function (
  categoryId: Types.ObjectId
): Promise<IFoodItemDocument[]> {
  return this.find({ category: categoryId, isAvailable: true }).sort({ name: 1 });
};

FoodItemSchema.statics.findAvailableByShop = function (
  shopId: Types.ObjectId
): Promise<IFoodItemDocument[]> {
  return this.find({ shop: shopId, isAvailable: true })
    .populate('category', 'name icon')
    .sort({ category: 1, name: 1 });
};

FoodItemSchema.statics.findActiveOffers = function (
  shopId?: Types.ObjectId
): Promise<IFoodItemDocument[]> {
  const now = new Date();
  const query: Record<string, unknown> = {
    isOffer: true,
    isAvailable: true,
    $or: [
      { offerStartDate: { $exists: false }, offerEndDate: { $exists: false } },
      { offerStartDate: { $lte: now }, offerEndDate: { $gte: now } },
      { offerStartDate: { $lte: now }, offerEndDate: { $exists: false } },
      { offerStartDate: { $exists: false }, offerEndDate: { $gte: now } },
    ],
  };

  if (shopId) {
    query['shop'] = shopId;
  }

  return this.find(query)
    .populate('shop', 'name')
    .populate('category', 'name')
    .sort({ offerEndDate: 1 });
};

FoodItemSchema.statics.updateRating = async function (
  itemId: Types.ObjectId,
  newRating: number
): Promise<IFoodItemDocument | null> {
  const item = await this.findById(itemId);
  if (!item) {
    return null;
  }

  // Calculate new average rating
  const totalScore = item.rating * item.totalRatings + newRating;
  const newTotalRatings = item.totalRatings + 1;
  const newAverageRating = totalScore / newTotalRatings;

  // Update the item
  item.rating = Math.round(newAverageRating * 10) / 10; // Round to 1 decimal
  item.totalRatings = newTotalRatings;
  await item.save();

  return item;
};

// Pre-save validation for offer fields
FoodItemSchema.pre('save', function (next) {
  // If offer is enabled, offerPrice must be provided
  if (this.isOffer && (this.offerPrice === undefined || this.offerPrice === null)) {
    return next(new Error('Offer price is required when offer is enabled'));
  }

  // Offer price should be less than regular price
  if (this.isOffer && this.offerPrice !== undefined && this.offerPrice >= this.price) {
    return next(new Error('Offer price must be less than regular price'));
  }

  // Validate offer date range
  if (this.offerStartDate && this.offerEndDate && this.offerStartDate > this.offerEndDate) {
    return next(new Error('Offer start date must be before end date'));
  }

  next();
});

// Create and export the model
export const FoodItem = mongoose.model<IFoodItemDocument, IFoodItemModel>('FoodItem', FoodItemSchema);

export default FoodItem;
