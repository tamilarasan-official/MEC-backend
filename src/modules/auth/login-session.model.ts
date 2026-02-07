/**
 * Login Session Model
 * Tracks user login sessions for security monitoring
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILoginSession {
  user: Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  deviceType: 'android' | 'ios' | 'web' | 'unknown';
  deviceName?: string;
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  deviceId?: string;
  macAddress?: string;
  imei?: string;
  deviceInfo?: {
    platform?: string;
    language?: string;
    screenResolution?: string;
    timezone?: string;
    colorDepth?: string;
    touchSupport?: string;
    hardwareConcurrency?: string;
    deviceMemory?: string;
    networkType?: string;
    brand?: string;
    model?: string;
    osVersion?: string;
  };
  loginTime: Date;
  logoutTime?: Date;
  isActive: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface ILoginSessionDocument extends ILoginSession, Document {
  _id: Types.ObjectId;
}

const LoginSessionSchema = new Schema<ILoginSessionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web', 'unknown'],
      default: 'unknown',
    },
    deviceName: {
      type: String,
    },
    os: {
      type: String,
    },
    osVersion: {
      type: String,
    },
    browser: {
      type: String,
    },
    browserVersion: {
      type: String,
    },
    deviceId: {
      type: String,
      sparse: true,
    },
    macAddress: {
      type: String,
      sparse: true,
    },
    imei: {
      type: String,
      sparse: true,
    },
    deviceInfo: {
      platform: { type: String },
      language: { type: String },
      screenResolution: { type: String },
      timezone: { type: String },
      colorDepth: { type: String },
      touchSupport: { type: String },
      hardwareConcurrency: { type: String },
      deviceMemory: { type: String },
      networkType: { type: String },
      brand: { type: String },
      model: { type: String },
      osVersion: { type: String },
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
    logoutTime: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
LoginSessionSchema.index({ user: 1, isActive: 1 });
LoginSessionSchema.index({ loginTime: -1 });
// TTL index: auto-delete sessions after 90 days
LoginSessionSchema.index({ loginTime: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const LoginSession = mongoose.model<ILoginSessionDocument>('LoginSession', LoginSessionSchema);

export default LoginSession;
