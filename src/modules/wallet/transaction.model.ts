import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Transaction types for wallet operations
export const TRANSACTION_TYPES = ['credit', 'debit', 'refund'] as const;
export type WalletTransactionType = (typeof TRANSACTION_TYPES)[number];

// Credit source types
export const CREDIT_SOURCES = ['cash_deposit', 'online_payment', 'refund', 'adjustment', 'adhoc_payment', 'complementary', 'pg_direct'] as const;
export type CreditSource = (typeof CREDIT_SOURCES)[number];

// Transaction status
export const TRANSACTION_STATUSES = ['pending', 'completed', 'failed', 'cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

// Transaction interface
export interface ITransaction {
  user: Types.ObjectId;
  type: WalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source?: CreditSource;
  description: string;
  status: TransactionStatus;

  // Reference fields
  order?: Types.ObjectId;
  processedBy?: Types.ObjectId; // Admin/accountant who processed

  // Metadata
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface ITransactionDocument extends ITransaction, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface ITransactionModel extends Model<ITransactionDocument> {
  findByUser(userId: Types.ObjectId, options?: { limit?: number; skip?: number }): Promise<ITransactionDocument[]>;
  findByOrder(orderId: Types.ObjectId): Promise<ITransactionDocument[]>;
  getUserBalance(userId: Types.ObjectId): Promise<number>;
}

// Transaction Schema
const TransactionSchema = new Schema<ITransactionDocument, ITransactionModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: TRANSACTION_TYPES,
        message: '{VALUE} is not a valid transaction type',
      },
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required'],
      min: [0, 'Balance before cannot be negative'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required'],
      min: [0, 'Balance after cannot be negative'],
    },
    source: {
      type: String,
      enum: {
        values: CREDIT_SOURCES,
        message: '{VALUE} is not a valid credit source',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: TRANSACTION_STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'completed',
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      sparse: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: ITransactionDocument, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Indexes
// Note: order and processedBy already have sparse indexes from their schema definitions
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });

// Static methods
TransactionSchema.statics.findByUser = function (
  userId: Types.ObjectId,
  options: { limit?: number; skip?: number } = {}
): Promise<ITransactionDocument[]> {
  const { limit = 50, skip = 0 } = options;
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('processedBy', 'name email')
    .populate('order', 'orderNumber');
};

TransactionSchema.statics.findByOrder = function (orderId: Types.ObjectId): Promise<ITransactionDocument[]> {
  return this.find({ order: orderId }).sort({ createdAt: -1 });
};

TransactionSchema.statics.getUserBalance = async function (userId: Types.ObjectId): Promise<number> {
  const result = await this.aggregate([
    { $match: { user: userId, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $cond: [{ $in: ['$type', ['credit', 'refund']] }, '$amount', 0],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
          },
        },
      },
    },
  ]);

  if (result.length === 0) {
    return 0;
  }

  return result[0].totalCredits - result[0].totalDebits;
};

// Create and export the model
export const Transaction = mongoose.model<ITransactionDocument, ITransactionModel>('Transaction', TransactionSchema);

export default Transaction;
