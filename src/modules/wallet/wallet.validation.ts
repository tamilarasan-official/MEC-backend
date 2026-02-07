import { z } from 'zod';

/**
 * Schema for crediting a user's wallet
 */
export const creditSchema = z.object({
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .positive('Amount must be a positive number')
    .max(100000, 'Amount cannot exceed 100,000'),
  source: z.enum(['cash_deposit', 'online_payment', 'complementary', 'pg_direct', 'adjustment'], {
    required_error: 'Source is required',
    invalid_type_error: 'Invalid payment source',
  }),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

/**
 * Schema for debiting a user's wallet
 */
export const debitSchema = z.object({
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .positive('Amount must be a positive number')
    .max(100000, 'Amount cannot exceed 100,000'),
  description: z
    .string({
      required_error: 'Description is required',
    })
    .min(1, 'Description is required')
    .max(500, 'Description cannot exceed 500 characters'),
});

/**
 * Schema for transaction filters
 */
export const transactionFiltersSchema = z.object({
  type: z.enum(['credit', 'debit', 'refund']).optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z
    .string()
    .datetime()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Schema for accountant transaction filters (more options)
 */
export const accountantTransactionFiltersSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(['credit', 'debit', 'refund']).optional(),
  source: z.enum(['cash_deposit', 'online_payment', 'refund', 'adjustment']).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z
    .string()
    .datetime()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Schema for updating vendor transfer status
 */
export const vendorTransferSchema = z.object({
  shopId: z
    .string({
      required_error: 'Shop ID is required',
      invalid_type_error: 'Shop ID must be a string',
    })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID format'),
  period: z
    .string({
      required_error: 'Period is required',
      invalid_type_error: 'Period must be a string',
    })
    .regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .nonnegative('Amount cannot be negative'),
  status: z.enum(['pending', 'completed'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status must be pending or completed',
  }),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional(),
});

// Type exports
export type CreditInput = z.infer<typeof creditSchema>;
export type DebitInput = z.infer<typeof debitSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type AccountantTransactionFilters = z.infer<typeof accountantTransactionFiltersSchema>;
export type VendorTransferInput = z.infer<typeof vendorTransferSchema>;
