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
  source: z.enum(['cash_deposit', 'online_payment'], {
    required_error: 'Source is required',
    invalid_type_error: 'Source must be either cash_deposit or online_payment',
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

// Type exports
export type CreditInput = z.infer<typeof creditSchema>;
export type DebitInput = z.infer<typeof debitSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type AccountantTransactionFilters = z.infer<typeof accountantTransactionFiltersSchema>;
