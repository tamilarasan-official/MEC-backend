import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { DEPARTMENTS, Department } from '../users/user.model.js';

// Target types for payment requests
export const TARGET_TYPES = ['all', 'selected', 'department', 'year'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

// Payment request status
export const PAYMENT_REQUEST_STATUSES = ['active', 'closed', 'cancelled'] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

// Payment request interface
export interface IPaymentRequest {
  title: string;
  description: string;
  amount: number;
  targetType: TargetType;
  targetStudents: Types.ObjectId[];
  targetDepartment?: Department;
  targetYear?: number;
  dueDate?: Date;
  status: PaymentRequestStatus;
  isVisibleOnDashboard: boolean;
  createdBy: Types.ObjectId;

  // Denormalized stats for performance
  totalTargetCount: number;
  paidCount: number;
  totalCollected: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface IPaymentRequestDocument extends IPaymentRequest, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface IPaymentRequestModel extends Model<IPaymentRequestDocument> {
  findActiveForStudent(studentId: Types.ObjectId, department?: string, year?: number): Promise<IPaymentRequestDocument[]>;
  findByCreator(creatorId: Types.ObjectId): Promise<IPaymentRequestDocument[]>;
}

// Payment Request Schema
const PaymentRequestSchema = new Schema<IPaymentRequestDocument, IPaymentRequestModel>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
      max: [100000, 'Amount cannot exceed 100000'],
    },
    targetType: {
      type: String,
      enum: {
        values: TARGET_TYPES,
        message: '{VALUE} is not a valid target type',
      },
      required: [true, 'Target type is required'],
    },
    targetStudents: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    targetDepartment: {
      type: String,
      enum: {
        values: DEPARTMENTS,
        message: '{VALUE} is not a valid department',
      },
    },
    targetYear: {
      type: Number,
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4'],
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_REQUEST_STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'active',
    },
    isVisibleOnDashboard: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },

    // Denormalized stats
    totalTargetCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCollected: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: IPaymentRequestDocument, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Indexes
PaymentRequestSchema.index({ status: 1, isVisibleOnDashboard: 1 });
PaymentRequestSchema.index({ createdBy: 1, createdAt: -1 });
PaymentRequestSchema.index({ targetStudents: 1 }, { sparse: true });
PaymentRequestSchema.index({ dueDate: 1 }, { sparse: true });
PaymentRequestSchema.index({ targetType: 1, targetDepartment: 1, targetYear: 1 });

// Static methods
PaymentRequestSchema.statics.findActiveForStudent = function (
  studentId: Types.ObjectId,
  department?: string,
  year?: number
): Promise<IPaymentRequestDocument[]> {
  const query: Record<string, unknown> = {
    status: 'active',
    isVisibleOnDashboard: true,
    $or: [
      { targetType: 'all' },
      { targetType: 'selected', targetStudents: studentId },
    ],
  };

  // Add department and year conditions
  if (department) {
    (query.$or as Record<string, unknown>[]).push({ targetType: 'department', targetDepartment: department });
  }
  if (year) {
    (query.$or as Record<string, unknown>[]).push({ targetType: 'year', targetYear: year });
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email');
};

PaymentRequestSchema.statics.findByCreator = function (creatorId: Types.ObjectId): Promise<IPaymentRequestDocument[]> {
  return this.find({ createdBy: creatorId }).sort({ createdAt: -1 });
};

// Pre-save validation for target type specific fields
PaymentRequestSchema.pre('save', function (next) {
  if (this.targetType === 'selected' && this.targetStudents.length === 0) {
    return next(new Error('Target students are required when target type is "selected"'));
  }
  if (this.targetType === 'department' && !this.targetDepartment) {
    return next(new Error('Target department is required when target type is "department"'));
  }
  if (this.targetType === 'year' && !this.targetYear) {
    return next(new Error('Target year is required when target type is "year"'));
  }
  next();
});

// Create and export the model
export const PaymentRequest = mongoose.model<IPaymentRequestDocument, IPaymentRequestModel>(
  'PaymentRequest',
  PaymentRequestSchema
);

export default PaymentRequest;
