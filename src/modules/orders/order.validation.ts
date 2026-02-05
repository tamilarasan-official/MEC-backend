import { z } from 'zod';
import { ORDER_STATUSES, LAUNDRY_CATEGORIES, XEROX_PAPER_SIZES } from './order.model.js';

// ============================================
// ORDER ITEM SCHEMA
// ============================================

const orderItemSchema = z.object({
  foodItemId: z
    .string()
    .min(1, 'Food item ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid food item ID format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Quantity cannot exceed 50'),
});

// ============================================
// CREATE ORDER SCHEMA
// ============================================

export const createOrderSchema = z.object({
  shopId: z
    .string()
    .min(1, 'Shop ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID format'),
  items: z
    .array(orderItemSchema)
    .min(1, 'Order must have at least one item')
    .max(20, 'Order cannot have more than 20 items'),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ============================================
// LAUNDRY ORDER SCHEMA
// ============================================

const laundryItemSchema = z.object({
  category: z.enum(LAUNDRY_CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${LAUNDRY_CATEGORIES.join(', ')}` }),
  }),
  count: z
    .number()
    .int('Count must be an integer')
    .min(1, 'Count must be at least 1')
    .max(100, 'Count cannot exceed 100'),
});

export const createLaundryOrderSchema = z.object({
  shopId: z
    .string()
    .min(1, 'Shop ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID format'),
  items: z
    .array(laundryItemSchema)
    .min(1, 'Laundry order must have at least one item')
    .max(10, 'Cannot have more than 10 laundry categories'),
  specialInstructions: z
    .string()
    .max(500, 'Special instructions cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type CreateLaundryOrderInput = z.infer<typeof createLaundryOrderSchema>;

// ============================================
// XEROX ORDER SCHEMA
// ============================================

export const createXeroxOrderSchema = z.object({
  shopId: z
    .string()
    .min(1, 'Shop ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID format'),
  pageCount: z
    .number()
    .int('Page count must be an integer')
    .min(1, 'Page count must be at least 1')
    .max(1000, 'Page count cannot exceed 1000'),
  copies: z
    .number()
    .int('Copies must be an integer')
    .min(1, 'Copies must be at least 1')
    .max(100, 'Copies cannot exceed 100'),
  colorType: z.enum(['bw', 'color'], {
    errorMap: () => ({ message: 'Color type must be bw or color' }),
  }),
  paperSize: z.enum(XEROX_PAPER_SIZES, {
    errorMap: () => ({ message: `Paper size must be one of: ${XEROX_PAPER_SIZES.join(', ')}` }),
  }),
  doubleSided: z.boolean().default(false),
  specialInstructions: z
    .string()
    .max(500, 'Special instructions cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type CreateXeroxOrderInput = z.infer<typeof createXeroxOrderSchema>;

// ============================================
// UPDATE STATUS SCHEMA
// ============================================

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` }),
  }),
  cancellationReason: z
    .string()
    .max(500, 'Cancellation reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ============================================
// VERIFY QR SCHEMA
// ============================================

export const verifyQrSchema = z.object({
  qrData: z
    .string()
    .min(1, 'QR data is required'),
});

export type VerifyQrInput = z.infer<typeof verifyQrSchema>;

// ============================================
// QUERY PARAMS SCHEMAS
// ============================================

export const orderQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
  status: z.enum(ORDER_STATUSES).optional(),
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid start date format'),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid end date format'),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;

// ============================================
// ORDER ID PARAM SCHEMA
// ============================================

export const orderIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID format'),
});

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

// ============================================
// CANCEL ORDER SCHEMA
// ============================================

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .max(500, 'Cancellation reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// ============================================
// VALIDATION HELPER
// ============================================

type ValidationResult<T> = { success: true; data: T } | { success: false; errors: z.ZodIssue[] };

export function validateSchema<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

// Specific validation functions to avoid type inference issues
export function validateCreateOrder(data: unknown): ValidationResult<CreateOrderInput> {
  const result = createOrderSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateUpdateStatus(data: unknown): ValidationResult<UpdateStatusInput> {
  const result = updateStatusSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateVerifyQr(data: unknown): ValidationResult<VerifyQrInput> {
  const result = verifyQrSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateOrderQuery(data: unknown): ValidationResult<OrderQueryInput> {
  const result = orderQuerySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateOrderIdParam(data: unknown): ValidationResult<OrderIdParam> {
  const result = orderIdParamSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateCancelOrder(data: unknown): ValidationResult<CancelOrderInput> {
  const result = cancelOrderSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateCreateLaundryOrder(data: unknown): ValidationResult<CreateLaundryOrderInput> {
  const result = createLaundryOrderSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateCreateXeroxOrder(data: unknown): ValidationResult<CreateXeroxOrderInput> {
  const result = createXeroxOrderSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
