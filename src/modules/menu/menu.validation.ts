import { z } from 'zod';

// MongoDB ObjectId regex pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// ============================================
// CATEGORY VALIDATION SCHEMAS
// ============================================

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(50, 'Category name cannot exceed 50 characters')
    .trim(),
  description: z
    .string()
    .max(200, 'Description cannot exceed 200 characters')
    .trim()
    .optional(),
  icon: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(50, 'Category name cannot exceed 50 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(200, 'Description cannot exceed 200 characters')
    .trim()
    .optional()
    .nullable(),
  icon: z.string().trim().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// FOOD ITEM VALIDATION SCHEMAS
// ============================================

const nutritionInfoSchema = z.object({
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
});

export const createFoodItemSchema = z.object({
  name: z
    .string()
    .min(2, 'Food item name must be at least 2 characters')
    .max(100, 'Food item name cannot exceed 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  price: z
    .number()
    .positive('Price must be positive'),
  costPrice: z
    .number()
    .min(0, 'Cost price cannot be negative')
    .optional(),
  categoryId: z
    .string()
    .regex(objectIdPattern, 'Invalid category ID format')
    .optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  isVegetarian: z.boolean().optional().default(false),
  preparationTime: z
    .number()
    .int()
    .min(1, 'Preparation time must be at least 1 minute')
    .max(180, 'Preparation time cannot exceed 180 minutes')
    .optional(),
  tags: z.array(z.string().trim()).optional().default([]),
  nutritionInfo: nutritionInfoSchema.optional(),
});

export const updateFoodItemSchema = z.object({
  name: z
    .string()
    .min(2, 'Food item name must be at least 2 characters')
    .max(100, 'Food item name cannot exceed 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  price: z
    .number()
    .positive('Price must be positive')
    .optional(),
  costPrice: z
    .number()
    .min(0, 'Cost price cannot be negative')
    .optional()
    .nullable(),
  categoryId: z
    .string()
    .regex(objectIdPattern, 'Invalid category ID format')
    .optional()
    .nullable(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable(),
  isVegetarian: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  preparationTime: z
    .number()
    .int()
    .min(1, 'Preparation time must be at least 1 minute')
    .max(180, 'Preparation time cannot exceed 180 minutes')
    .optional()
    .nullable(),
  tags: z.array(z.string().trim()).optional(),
  nutritionInfo: nutritionInfoSchema.optional().nullable(),
});

export const setOfferSchema = z.object({
  offerPrice: z
    .number()
    .positive('Offer price must be positive'),
  offerEndDate: z
    .string()
    .datetime('Invalid date format. Use ISO 8601 format')
    .refine(
      (date) => new Date(date) > new Date(),
      'Offer end date must be in the future'
    ),
});

// ============================================
// PARAMETER SCHEMAS
// ============================================

export const shopIdParamSchema = z.object({
  shopId: z.string().regex(objectIdPattern, 'Invalid shop ID format'),
});

export const menuItemIdParamSchema = z.object({
  id: z.string().regex(objectIdPattern, 'Invalid menu item ID format'),
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string().regex(objectIdPattern, 'Invalid category ID format'),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const menuQuerySchema = z.object({
  categoryId: z.string().regex(objectIdPattern, 'Invalid category ID format').optional(),
  search: z.string().max(100).optional(),
  availableOnly: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  vegetarianOnly: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateFoodItemInput = z.infer<typeof createFoodItemSchema>;
export type UpdateFoodItemInput = z.infer<typeof updateFoodItemSchema>;
export type SetOfferInput = z.infer<typeof setOfferSchema>;
export type ShopIdParam = z.infer<typeof shopIdParamSchema>;
export type MenuItemIdParam = z.infer<typeof menuItemIdParamSchema>;
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
export type MenuQuery = z.infer<typeof menuQuerySchema>;
