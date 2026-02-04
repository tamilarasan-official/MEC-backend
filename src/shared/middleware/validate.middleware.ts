/**
 * Validation Middleware
 * Generic validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { AppError } from './error.middleware.js';
import { HttpStatus } from '../../config/constants.js';
import { ValidationError } from '../types/index.js';

// ============================================
// TYPES
// ============================================

/**
 * Source of data to validate
 */
export type ValidationSource = 'body' | 'query' | 'params' | 'headers';

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Whether to strip unknown keys (default: true) */
  stripUnknown?: boolean;
  /** Whether to abort early on first error (default: false) */
  abortEarly?: boolean;
  /** Custom error message */
  customMessage?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format Zod issues into validation errors
 */
function formatZodErrors(issues: ZodIssue[]): ValidationError[] {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Create a user-friendly error message from Zod errors
 */
function createErrorMessage(errors: ValidationError[]): string {
  if (errors.length === 1) {
    const error = errors[0];
    return error.field
      ? `${error.field}: ${error.message}`
      : error.message;
  }
  return `Validation failed with ${errors.length} error(s)`;
}

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Generic validation middleware using Zod schemas
 * @param schema - Zod schema to validate against
 * @param source - Source of data to validate (body, query, params, headers)
 * @param options - Validation options
 */
export function validate<T>(
  schema: ZodSchema<T>,
  source: ValidationSource = 'body',
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, customMessage } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get data from the appropriate source
      let data: unknown;
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        case 'headers':
          data = req.headers;
          break;
        default:
          data = req.body;
      }

      // Parse and validate data
      const validatedData = await schema.parseAsync(data);

      // Replace source data with validated/transformed data
      switch (source) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          // Cast to satisfy TypeScript - query is validated/transformed
          (req as { query: unknown }).query = validatedData;
          break;
        case 'params':
          // Cast to satisfy TypeScript - params is validated/transformed
          (req as { params: unknown }).params = validatedData;
          break;
        // Headers are read-only, don't replace
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error.issues);
        const message = customMessage ?? createErrorMessage(validationErrors);

        next(
          new AppError(
            message,
            HttpStatus.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            true,
            validationErrors
          )
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate request body
 */
export function validateBody<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'body', options);
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'query', options);
}

/**
 * Validate route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'params', options);
}

/**
 * Validate request headers
 */
export function validateHeaders<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'headers', options);
}

// ============================================
// COMBINED VALIDATION
// ============================================

interface CombinedSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate multiple sources at once
 */
export function validateRequest(schemas: CombinedSchemas, options?: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: ValidationError[] = [];

    // Validate body if schema provided
    if (schemas.body) {
      try {
        req.body = await schemas.body.parseAsync(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...formatZodErrors(error.issues).map((e) => ({
              ...e,
              field: `body.${e.field}`,
            }))
          );
        }
      }
    }

    // Validate query if schema provided
    if (schemas.query) {
      try {
        (req as { query: unknown }).query = await schemas.query.parseAsync(req.query);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...formatZodErrors(error.issues).map((e) => ({
              ...e,
              field: `query.${e.field}`,
            }))
          );
        }
      }
    }

    // Validate params if schema provided
    if (schemas.params) {
      try {
        (req as { params: unknown }).params = await schemas.params.parseAsync(req.params);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...formatZodErrors(error.issues).map((e) => ({
              ...e,
              field: `params.${e.field}`,
            }))
          );
        }
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      const message = options?.customMessage ?? `Validation failed with ${errors.length} error(s)`;
      return next(
        new AppError(
          message,
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          true,
          errors
        )
      );
    }

    next();
  };
}

// ============================================
// COMMON VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';

/**
 * Common MongoDB ObjectId validation
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

/**
 * Common pagination query schema
 */
export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, 'Page must be positive'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
});

/**
 * Common sort query schema
 */
export const sortQuerySchema = z.object({
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Common ID params schema
 */
export const idParamsSchema = z.object({
  id: objectIdSchema,
});

/**
 * Common email validation
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

/**
 * Common phone validation (Indian format)
 */
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid phone number format');

/**
 * Common password validation
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must not exceed 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
