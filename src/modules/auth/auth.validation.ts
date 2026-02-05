/**
 * Authentication Validation Schemas
 * Zod schemas for validating authentication requests
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { DEPARTMENTS, YEARS } from '../users/user.model.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Register schema for student registration
 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(4, 'Username must be at least 4 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, 'Password must contain at least one special character'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .transform((val) => val.toLowerCase()),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  rollNumber: z
    .string()
    .min(1, 'Roll number is required')
    .max(20, 'Roll number cannot exceed 20 characters')
    .transform((val) => val.toUpperCase()),
  department: z.enum(DEPARTMENTS, {
    errorMap: () => ({ message: 'Please select a valid department' }),
  }),
  year: z
    .number()
    .int()
    .refine((val): val is 1 | 2 | 3 | 4 => YEARS.includes(val as 1 | 2 | 3 | 4), {
      message: 'Year must be between 1 and 4',
    }),
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, 'Password must contain at least one special character'),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================
// VALIDATION MIDDLEWARE HELPER
// ============================================

/**
 * Creates a validation middleware for the given Zod schema
 * Validates request body against the schema and attaches validated data to req.body
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next(error);
    }
  };
}

/**
 * Validates query parameters against a schema
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next(error);
    }
  };
}

/**
 * Validates request params against a schema
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next(error);
    }
  };
}

export default {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  validate,
  validateQuery,
  validateParams,
};
