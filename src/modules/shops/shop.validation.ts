import { z } from 'zod';
import { SHOP_CATEGORIES } from './shop.model.js';

// Operating hours schema
const operatingHoursSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:mm'),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:mm'),
  isClosed: z.boolean().default(false),
});

// Owner details schema for creating owner during shop creation
const ownerDetailsSchema = z.object({
  name: z
    .string()
    .min(2, 'Owner name must be at least 2 characters')
    .max(100, 'Owner name cannot exceed 100 characters')
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

// Create shop schema
export const createShopSchema = z.object({
  name: z
    .string()
    .min(2, 'Shop name must be at least 2 characters')
    .max(100, 'Shop name cannot exceed 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  category: z.enum(SHOP_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid shop category' }),
  }),
  ownerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid owner ID format').optional(),
  // Optional: Create new owner during shop creation
  ownerDetails: ownerDetailsSchema.optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  bannerUrl: z.string().url('Invalid banner URL').optional(),
  operatingHours: z.array(operatingHoursSchema).optional(),
  contactPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
});

// Types
export type OwnerDetails = z.infer<typeof ownerDetailsSchema>;

// Update shop schema - all fields optional
export const updateShopSchema = z.object({
  name: z
    .string()
    .min(2, 'Shop name must be at least 2 characters')
    .max(100, 'Shop name cannot exceed 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  category: z.enum(SHOP_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid shop category' }),
  }).optional(),
  ownerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid owner ID format').optional().nullable(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable(),
  bannerUrl: z.string().url('Invalid banner URL').optional().nullable(),
  operatingHours: z.array(operatingHoursSchema).optional(),
  contactPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

// ID parameter schema
export const shopIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID format'),
});

// Query parameters schema
export const shopQuerySchema = z.object({
  activeOnly: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  category: z.enum(SHOP_CATEGORIES).optional(),
});

// Types derived from schemas
export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type ShopIdParam = z.infer<typeof shopIdParamSchema>;
export type ShopQuery = z.infer<typeof shopQuerySchema>;
