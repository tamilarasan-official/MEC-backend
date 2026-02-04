import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Base category interface
export interface ICategory {
  shop: Types.ObjectId;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface (includes Mongoose document methods)
export interface ICategoryDocument extends ICategory, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface ICategoryModel extends Model<ICategoryDocument> {
  findByShop(shopId: Types.ObjectId): Promise<ICategoryDocument[]>;
  findActiveByShop(shopId: Types.ObjectId): Promise<ICategoryDocument[]>;
  getNextSortOrder(shopId: Types.ObjectId): Promise<number>;
}

// Category Schema
const CategorySchema = new Schema<ICategoryDocument, ICategoryModel>(
  {
    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    icon: {
      type: String,
      trim: true,
      maxlength: [100, 'Icon name/URL cannot exceed 100 characters'],
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: [0, 'Sort order cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: ICategoryDocument, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Unique compound index on shop + name (case-insensitive)
CategorySchema.index(
  { shop: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 }, // Case-insensitive uniqueness
  }
);

// Additional indexes for efficient querying
CategorySchema.index({ shop: 1, isActive: 1 });
CategorySchema.index({ shop: 1, sortOrder: 1 });

// Static methods
CategorySchema.statics.findByShop = function (shopId: Types.ObjectId): Promise<ICategoryDocument[]> {
  return this.find({ shop: shopId }).sort({ sortOrder: 1, name: 1 });
};

CategorySchema.statics.findActiveByShop = function (
  shopId: Types.ObjectId
): Promise<ICategoryDocument[]> {
  return this.find({ shop: shopId, isActive: true }).sort({ sortOrder: 1, name: 1 });
};

CategorySchema.statics.getNextSortOrder = async function (shopId: Types.ObjectId): Promise<number> {
  const lastCategory = await this.findOne({ shop: shopId })
    .sort({ sortOrder: -1 })
    .select('sortOrder')
    .lean();

  return lastCategory ? lastCategory.sortOrder + 1 : 0;
};

// Pre-save hook to auto-assign sort order if not provided
CategorySchema.pre('save', async function (next) {
  if (this.isNew && this.sortOrder === 0) {
    const CategoryModel = this.constructor as ICategoryModel;
    this.sortOrder = await CategoryModel.getNextSortOrder(this.shop);
  }
  next();
});

// Create and export the model
export const Category = mongoose.model<ICategoryDocument, ICategoryModel>('Category', CategorySchema);

export default Category;
