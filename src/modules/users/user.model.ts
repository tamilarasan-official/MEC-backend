import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// User role types
export const USER_ROLES = ['student', 'captain', 'owner', 'accountant', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Department types for students
export const DEPARTMENTS = [
  'CSE',
  'ECE',
  'EEE',
  'MECH',
  'CIVIL',
  'IT',
  'AIDS',
  'AIML',
  'OTHER',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// Year of study
export const YEARS = [1, 2, 3, 4] as const;
export type Year = (typeof YEARS)[number];

// FCM Token interface for push notifications
export interface IFcmToken {
  token: string;
  deviceType: 'android' | 'ios' | 'web';
  createdAt: Date;
  lastUsedAt: Date;
}

// Base user interface
export interface IUser {
  username: string;
  passwordHash: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isApproved: boolean;
  isActive: boolean;

  // Student-specific fields
  rollNumber?: string;
  department?: Department;
  year?: Year;
  balance: number;
  dietPreference: 'all' | 'veg' | 'nonveg';

  // Staff-specific fields (captain, owner, accountant)
  shop?: Types.ObjectId;

  // Push notification tokens
  fcmTokens: IFcmToken[];

  // Activity tracking
  lastLoginAt?: Date;

  // Security: Account lockout
  failedLoginAttempts: number;
  lastFailedLoginAt?: Date;
  accountLockedUntil?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document interface (includes Mongoose document methods)
export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

// Model interface for static methods
export interface IUserModel extends Model<IUserDocument> {
  findByUsername(username: string): Promise<IUserDocument | null>;
  findByEmail(email: string): Promise<IUserDocument | null>;
  findActiveStudents(): Promise<IUserDocument[]>;
  findShopStaff(shopId: Types.ObjectId): Promise<IUserDocument[]>;
}

// FCM Token Schema
const FcmTokenSchema = new Schema<IFcmToken>(
  {
    token: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// User Schema
const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never include in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'Role is required'],
      default: 'student',
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Student-specific fields
    rollNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    department: {
      type: String,
      enum: {
        values: DEPARTMENTS,
        message: '{VALUE} is not a valid department',
      },
    },
    year: {
      type: Number,
      enum: {
        values: YEARS,
        message: '{VALUE} is not a valid year',
      },
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    dietPreference: {
      type: String,
      enum: ['all', 'veg', 'nonveg'],
      default: 'all',
    },

    // Staff-specific fields
    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      sparse: true,
    },

    // FCM tokens for push notifications
    fcmTokens: {
      type: [FcmTokenSchema],
      default: [],
    },

    // Activity tracking
    lastLoginAt: {
      type: Date,
    },

    // Security: Account lockout
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedLoginAt: {
      type: Date,
    },
    accountLockedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: IUserDocument, ret: Record<string, unknown>) => {
        // Remove sensitive fields from JSON output
        delete ret['passwordHash'];
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
// Note: username, email have unique indexes; shop has sparse index from schema definitions
UserSchema.index({ role: 1 });
UserSchema.index({ isApproved: 1 });
UserSchema.index({ isActive: 1, role: 1 });
UserSchema.index({ role: 1, isApproved: 1, isActive: 1 });

// Compound index for student queries
UserSchema.index({ role: 1, department: 1, year: 1 });

// Static methods
UserSchema.statics.findByUsername = function (username: string): Promise<IUserDocument | null> {
  return this.findOne({ username: username.toLowerCase() });
};

UserSchema.statics.findByEmail = function (email: string): Promise<IUserDocument | null> {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findActiveStudents = function (): Promise<IUserDocument[]> {
  return this.find({ role: 'student', isActive: true, isApproved: true });
};

UserSchema.statics.findShopStaff = function (shopId: Types.ObjectId): Promise<IUserDocument[]> {
  return this.find({
    shop: shopId,
    role: { $in: ['captain', 'owner', 'accountant'] },
    isActive: true,
  });
};

// Pre-save validation for role-specific fields
UserSchema.pre('save', function (next) {
  // Students must have rollNumber, department, and year
  if (this.role === 'student') {
    if (!this.rollNumber) {
      return next(new Error('Roll number is required for students'));
    }
    if (!this.department) {
      return next(new Error('Department is required for students'));
    }
    if (!this.year) {
      return next(new Error('Year is required for students'));
    }
  }

  // Shop staff must have a shop assigned (captain, owner)
  // Note: accountant and superadmin work at organization level, not shop level
  if (['captain', 'owner'].includes(this.role)) {
    if (!this.shop) {
      return next(new Error('Shop assignment is required for shop staff'));
    }
  }

  next();
});

// Create and export the model
export const User = mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

export default User;
