/**
 * Owner Validation Schemas
 * Zod schemas for validating owner operations
 */

import { z } from 'zod';

// Create captain schema
export const createCaptainSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
});

// Captain ID parameter schema
export const captainIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid captain ID format'),
});

// Types
export type CreateCaptainInput = z.infer<typeof createCaptainSchema>;
export type CaptainIdParam = z.infer<typeof captainIdParamSchema>;
