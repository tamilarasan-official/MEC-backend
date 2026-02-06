import { z } from 'zod';
import { TARGET_TYPES, PAYMENT_REQUEST_STATUSES } from './payment-request.model.js';
import { DEPARTMENTS } from '../users/user.model.js';

// ============================================
// OBJECT ID REGEX
// ============================================

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================
// CREATE PAYMENT REQUEST SCHEMA
// ============================================

export const createPaymentRequestSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title cannot exceed 100 characters')
      .trim(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(500, 'Description cannot exceed 500 characters')
      .trim(),
    amount: z
      .number()
      .positive('Amount must be positive')
      .max(100000, 'Amount cannot exceed 100000'),
    targetType: z.enum(TARGET_TYPES, {
      errorMap: () => ({ message: `Target type must be one of: ${TARGET_TYPES.join(', ')}` }),
    }),
    targetStudents: z
      .array(z.string().regex(objectIdRegex, 'Invalid student ID format'))
      .optional(),
    targetDepartment: z.enum(DEPARTMENTS).optional(),
    targetYear: z.number().int().min(1).max(4).optional(),
    dueDate: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format')
      .optional(),
    isVisibleOnDashboard: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.targetType === 'selected') {
        return data.targetStudents && data.targetStudents.length > 0;
      }
      return true;
    },
    { message: 'Target students are required when target type is "selected"', path: ['targetStudents'] }
  )
  .refine(
    (data) => {
      if (data.targetType === 'department') {
        return !!data.targetDepartment;
      }
      return true;
    },
    { message: 'Target department is required when target type is "department"', path: ['targetDepartment'] }
  )
  .refine(
    (data) => {
      if (data.targetType === 'year') {
        return !!data.targetYear;
      }
      return true;
    },
    { message: 'Target year is required when target type is "year"', path: ['targetYear'] }
  );

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;

// ============================================
// UPDATE PAYMENT REQUEST SCHEMA
// ============================================

export const updatePaymentRequestSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  isVisibleOnDashboard: z.boolean().optional(),
  dueDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .nullable()
    .optional(),
});

export type UpdatePaymentRequestInput = z.infer<typeof updatePaymentRequestSchema>;

// ============================================
// CLOSE PAYMENT REQUEST SCHEMA
// ============================================

export const closePaymentRequestSchema = z.object({
  status: z.enum(['closed', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be either "closed" or "cancelled"' }),
  }),
});

export type ClosePaymentRequestInput = z.infer<typeof closePaymentRequestSchema>;

// ============================================
// PAYMENT REQUEST FILTERS SCHEMA
// ============================================

export const paymentRequestFiltersSchema = z.object({
  status: z.union([z.enum(PAYMENT_REQUEST_STATUSES), z.literal('')]).optional().transform(val => val || undefined),
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
});

export type PaymentRequestFilters = z.infer<typeof paymentRequestFiltersSchema>;

// ============================================
// STUDENT PAYMENT FILTERS SCHEMA
// ============================================

export const studentPaymentFiltersSchema = z.object({
  status: z.enum(['paid', 'pending', 'all']).default('all'),
  search: z.string().optional(),
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
});

export type StudentPaymentFilters = z.infer<typeof studentPaymentFiltersSchema>;

// ============================================
// PAYMENT HISTORY FILTERS SCHEMA
// ============================================

export const historyFiltersSchema = z.object({
  status: z.enum(['paid', 'pending', 'all']).default('all'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(50).default(20)),
});

export type HistoryFilters = z.infer<typeof historyFiltersSchema>;

// ============================================
// REQUEST ID PARAM SCHEMA
// ============================================

export const requestIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid request ID format'),
});

export type RequestIdParam = z.infer<typeof requestIdParamSchema>;

// ============================================
// VALIDATION HELPER
// ============================================

type ValidationResult<T> = { success: true; data: T } | { success: false; errors: z.ZodIssue[] };

export function validateCreatePaymentRequest(data: unknown): ValidationResult<CreatePaymentRequestInput> {
  const result = createPaymentRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateUpdatePaymentRequest(data: unknown): ValidationResult<UpdatePaymentRequestInput> {
  const result = updatePaymentRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateClosePaymentRequest(data: unknown): ValidationResult<ClosePaymentRequestInput> {
  const result = closePaymentRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validatePaymentRequestFilters(data: unknown): ValidationResult<PaymentRequestFilters> {
  const result = paymentRequestFiltersSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateStudentPaymentFilters(data: unknown): ValidationResult<StudentPaymentFilters> {
  const result = studentPaymentFiltersSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateHistoryFilters(data: unknown): ValidationResult<HistoryFilters> {
  const result = historyFiltersSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateRequestIdParam(data: unknown): ValidationResult<RequestIdParam> {
  const result = requestIdParamSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
