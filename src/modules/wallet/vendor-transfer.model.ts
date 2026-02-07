import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Transfer status types
export const TRANSFER_STATUSES = ['pending', 'completed'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

// Vendor transfer interface
export interface IVendorTransfer {
  shop: Types.ObjectId;
  amount: number;
  period: string; // e.g. "2026-02" for Feb 2026
  status: TransferStatus;
  notes?: string;
  processedBy: Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface IVendorTransferDocument extends IVendorTransfer, Document {
  _id: Types.ObjectId;
}

// Model interface
export interface IVendorTransferModel extends Model<IVendorTransferDocument> {
  findByShopAndPeriod(shopId: Types.ObjectId, period: string): Promise<IVendorTransferDocument | null>;
}

// Schema
const VendorTransferSchema = new Schema<IVendorTransferDocument>(
  {
    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    period: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'],
    },
    status: {
      type: String,
      enum: TRANSFER_STATUSES,
      default: 'pending',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique shop+period
VendorTransferSchema.index({ shop: 1, period: 1 }, { unique: true });

// Static methods
VendorTransferSchema.statics.findByShopAndPeriod = function (
  shopId: Types.ObjectId,
  period: string
) {
  return this.findOne({ shop: shopId, period });
};

// JSON transform
VendorTransferSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    obj.id = obj._id;
    delete obj._id;
    delete obj.__v;
    return obj;
  },
});

export const VendorTransfer = mongoose.model<IVendorTransferDocument, IVendorTransferModel>(
  'VendorTransfer',
  VendorTransferSchema
);
