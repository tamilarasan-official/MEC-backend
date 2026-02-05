/**
 * Authentication Service
 * Business logic for authentication operations
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload as JWTLibPayload } from 'jsonwebtoken';
const { TokenExpiredError, JsonWebTokenError } = jwt;
import { Types } from 'mongoose';
import { User, IUserDocument, UserRole, Department, Year } from '../users/user.model.js';
import { logger } from '../../config/logger.js';
import { JwtConfig } from '../../config/constants.js';

// ============================================
// TYPES
// ============================================

export interface RegisterData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone?: string;
  rollNumber: string;
  department: Department;
  year: Year;
}

export interface LoginResult {
  user: UserPublicData;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  shopId?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

export interface UserPublicData {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isApproved: boolean;
  isActive: boolean;
  rollNumber?: string;
  department?: Department;
  year?: Year;
  balance: number;
  shopId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CONFIGURATION
// ============================================

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '15m';
const REFRESH_TOKEN_EXPIRY = process.env['JWT_REFRESH_TOKEN_EXPIRY'] ?? '7d';

// Account lockout configuration
const LOCKOUT_THRESHOLD = parseInt(process.env['ACCOUNT_LOCKOUT_THRESHOLD'] ?? '5', 10);
const LOCKOUT_DURATION_MS = parseInt(process.env['ACCOUNT_LOCKOUT_DURATION_MINUTES'] ?? '15', 10) * 60 * 1000;

/**
 * Get JWT access secret from environment
 */
function getAccessSecret(): string {
  const secret = process.env['JWT_ACCESS_SECRET'] ?? process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET or JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Get JWT refresh secret from environment
 */
function getRefreshSecret(): string {
  const secret = process.env['JWT_REFRESH_SECRET'] ?? process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET or JWT_SECRET environment variable is not set');
  }
  return secret;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize legacy roles to new roles
 * Maps: admin -> accountant, super_admin -> superadmin, canteen -> captain
 */
function normalizeRole(role: string): UserRole {
  const roleMap: Record<string, UserRole> = {
    'admin': 'accountant',
    'super_admin': 'superadmin',
    'canteen': 'captain',
  };
  return (roleMap[role] || role) as UserRole;
}

/**
 * Convert user document to public data (without sensitive fields)
 * Note: Roles are normalized (admin->accountant, super_admin->superadmin, canteen->captain)
 */
function toPublicUser(user: IUserDocument): UserPublicData {
  return {
    id: user._id.toString(),
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: normalizeRole(user.role),
    isApproved: user.isApproved,
    isActive: user.isActive,
    rollNumber: user.rollNumber,
    department: user.department,
    year: user.year,
    balance: user.balance,
    shopId: user.shop?.toString(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Generate a unique token ID for refresh tokens
 */
function generateTokenId(): string {
  return new Types.ObjectId().toString();
}

// ============================================
// AUTH SERVICE CLASS
// ============================================

export class AuthService {
  /**
   * Register a new student user
   * New students are created with isApproved=false and must be approved by admin
   */
  async register(data: RegisterData): Promise<UserPublicData> {
    const { username, password, name, email, phone, rollNumber, department, year } = data;

    // Check if username already exists
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      throw new AuthError('Username already taken', 'USERNAME_EXISTS', 409);
    }

    // Check if email already exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      throw new AuthError('Email already registered', 'EMAIL_EXISTS', 409);
    }

    // Check if roll number already exists
    const existingRollNumber = await User.findOne({ rollNumber: rollNumber.toUpperCase() });
    if (existingRollNumber) {
      throw new AuthError('Roll number already registered', 'ROLL_NUMBER_EXISTS', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await User.create({
      username,
      passwordHash,
      name,
      email,
      phone,
      rollNumber,
      department,
      year,
      role: 'student',
      isApproved: false, // Students need admin approval
      isActive: true,
      balance: 0,
    });

    logger.info(`New student registered: ${username} (${email})`);

    return toPublicUser(user);
  }

  /**
   * Login user with username and password
   * Returns tokens and user data on success
   * Implements account lockout after multiple failed attempts
   */
  async login(username: string, password: string): Promise<LoginResult> {
    // Find user with password hash (excluded by default)
    const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');

    if (!user) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingMs = user.accountLockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new AuthError(
        `Account is locked. Please try again in ${remainingMinutes} minute(s).`,
        'ACCOUNT_LOCKED',
        423
      );
    }

    // Reset lockout if duration has passed
    if (user.accountLockedUntil && user.accountLockedUntil <= new Date()) {
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = undefined;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date();

      // Lock account if threshold exceeded
      if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        user.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await user.save();
        logger.warn(`Account locked due to failed attempts: ${username}`);
        throw new AuthError(
          `Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MS / 60000} minutes.`,
          'ACCOUNT_LOCKED',
          423
        );
      }

      await user.save();
      const attemptsRemaining = LOCKOUT_THRESHOLD - user.failedLoginAttempts;
      logger.warn(`Failed login attempt for: ${username} (${attemptsRemaining} attempts remaining)`);
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthError('Account has been deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    // Check if user is approved (for students)
    if (user.role === 'student' && !user.isApproved) {
      throw new AuthError(
        'Account pending approval. Please wait for admin approval.',
        'ACCOUNT_NOT_APPROVED',
        403
      );
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    logger.info(`User logged in: ${username}`);

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   * Returns new access token (and optionally new refresh token)
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify refresh token
    const payload = this.verifyRefreshToken(token);

    // Find user
    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
    }

    // Check if user is still active
    if (!user.isActive) {
      throw new AuthError('Account has been deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    logger.debug(`Tokens refreshed for user: ${user.username}`);

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token for user
   * Token includes: id (sub), role, email, shopId (if applicable)
   * Expires in 15 minutes by default
   * Note: Roles are normalized (admin->accountant, super_admin->superadmin, canteen->captain)
   */
  generateAccessToken(user: IUserDocument): string {
    const payload: TokenPayload = {
      sub: user._id.toString(),
      role: normalizeRole(user.role),
      email: user.email,
    };

    // Include shopId for staff members
    if (user.shop) {
      payload.shopId = user.shop.toString();
    }

    return jwt.sign(payload, getAccessSecret(), {
      expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
      issuer: JwtConfig.ISSUER,
      audience: JwtConfig.AUDIENCE,
    });
  }

  /**
   * Generate refresh token for user
   * Token includes: id (sub), tokenId (for revocation), type
   * Expires in 7 days by default
   */
  generateRefreshToken(user: IUserDocument): string {
    const payload: RefreshTokenPayload = {
      sub: user._id.toString(),
      tokenId: generateTokenId(),
      type: 'refresh',
    };

    return jwt.sign(payload, getRefreshSecret(), {
      expiresIn: REFRESH_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
      issuer: JwtConfig.ISSUER,
      audience: JwtConfig.AUDIENCE,
    });
  }

  /**
   * Verify and decode access token
   * Throws AuthError on invalid or expired token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, getAccessSecret(), {
        issuer: JwtConfig.ISSUER,
        audience: JwtConfig.AUDIENCE,
      }) as JWTLibPayload & TokenPayload;

      return {
        sub: decoded.sub,
        role: decoded.role,
        email: decoded.email,
        shopId: decoded.shopId,
      };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthError('Access token has expired', 'TOKEN_EXPIRED', 401);
      }
      if (error instanceof JsonWebTokenError) {
        throw new AuthError('Invalid access token', 'INVALID_TOKEN', 401);
      }
      throw error;
    }
  }

  /**
   * Verify and decode refresh token
   * Throws AuthError on invalid or expired token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, getRefreshSecret(), {
        issuer: JwtConfig.ISSUER,
        audience: JwtConfig.AUDIENCE,
      }) as JWTLibPayload & RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new AuthError('Invalid token type', 'INVALID_TOKEN', 401);
      }

      return {
        sub: decoded.sub,
        tokenId: decoded.tokenId,
        type: decoded.type,
      };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthError('Refresh token has expired', 'TOKEN_EXPIRED', 401);
      }
      if (error instanceof JsonWebTokenError) {
        throw new AuthError('Invalid refresh token', 'INVALID_TOKEN', 401);
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserPublicData | null> {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }
    return toPublicUser(user);
  }

  /**
   * Change user password
   * Requires current password verification
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Find user with password hash
    const user = await User.findById(userId).select('+passwordHash');

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError('Current password is incorrect', 'INVALID_PASSWORD', 401);
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    user.passwordHash = newPasswordHash;
    await user.save();

    logger.info(`Password changed for user: ${user.username}`);
  }
}

// ============================================
// CUSTOM AUTH ERROR CLASS
// ============================================

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const authService = new AuthService();

export default authService;
