import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Submission status types
export const SUBMISSION_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// Payment submission interface
export interface IPaymentSubmission {
  paymentRequest: Types.ObjectId;
  student: Types.ObjectId;
  status: SubmissionStatus;
  amount: number;
  transaction?: Types.ObjectId;
  paidAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface
export interface IPaymentSubmissionDocument extends IPaymentSubmission, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface IPaymentSubmissionModel extends Model<IPaymentSubmissionDocument> {
  findByStudentAndRequest(
    studentId: Types.ObjectId,
    requestId: Types.ObjectId
  ): Promise<IPaymentSubmissionDocument | null>;
  findPendingForStudent(studentId: Types.ObjectId): Promise<IPaymentSubmissionDocument[]>;
  getUnpaidStudentsForRequest(requestId: Types.ObjectId): Promise<Types.ObjectId[]>;
  countByRequestAndStatus(requestId: Types.ObjectId, status: SubmissionStatus): Promise<number>;
}

// Payment Submission Schema
const PaymentSubmissionSchema = new Schema<IPaymentSubmissionDocument, IPaymentSubmissionModel>(
  {
    paymentRequest: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentRequest',
      required: [true, 'Payment request is required'],
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required'],
    },
    status: {
      type: String,
      enum: {
        values: SUBMISSION_STATUSES,
        message: '{VALUE} is not a valid submission status',
      },
      default: 'pending',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: IPaymentSubmissionDocument, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Unique compound index - one submission per student per request
PaymentSubmissionSchema.index({ paymentRequest: 1, student: 1 }, { unique: true });

// Additional indexes for queries
PaymentSubmissionSchema.index({ student: 1, status: 1 });
PaymentSubmissionSchema.index({ paymentRequest: 1, status: 1 });
PaymentSubmissionSchema.index({ paidAt: -1 }, { sparse: true });

// Static methods
PaymentSubmissionSchema.statics.findByStudentAndRequest = function (
  studentId: Types.ObjectId,
  requestId: Types.ObjectId
): Promise<IPaymentSubmissionDocument | null> {
  return this.findOne({ student: studentId, paymentRequest: requestId });
};

PaymentSubmissionSchema.statics.findPendingForStudent = function (
  studentId: Types.ObjectId
): Promise<IPaymentSubmissionDocument[]> {
  return this.find({ student: studentId, status: 'pending' })
    .populate({
      path: 'paymentRequest',
      match: { status: 'active', isVisibleOnDashboard: true },
      populate: { path: 'createdBy', select: 'name email' },
    })
    .sort({ createdAt: -1 });
};

PaymentSubmissionSchema.statics.getUnpaidStudentsForRequest = async function (
  requestId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  const submissions = await this.find({
    paymentRequest: requestId,
    status: { $ne: 'paid' },
  }).select('student');

  return submissions.map((s) => s.student);
};

PaymentSubmissionSchema.statics.countByRequestAndStatus = function (
  requestId: Types.ObjectId,
  status: SubmissionStatus
): Promise<number> {
  return this.countDocuments({ paymentRequest: requestId, status });
};

// Create and export the model
export const PaymentSubmission = mongoose.model<IPaymentSubmissionDocument, IPaymentSubmissionModel>(
  'PaymentSubmission',
  PaymentSubmissionSchema
);

export default PaymentSubmission;
