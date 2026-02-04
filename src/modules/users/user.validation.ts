import { z } from 'zod';
import { USER_ROLES, DEPARTMENTS, YEARS } from './user.model.js';

/**
 * Schema for updating user profile
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  avatarUrl: z
    .string()
    .url('Please provide a valid URL')
    .optional(),
});

/**
 * Schema for updating user role (superadmin only)
 */
export const updateRoleSchema = z.object({
  role: z.enum(USER_ROLES, {
    required_error: 'Role is required',
    invalid_type_error: `Role must be one of: ${USER_ROLES.join(', ')}`,
  }),
  shopId: z
    .string()
    .min(1, 'Shop ID is required for captain or owner')
    .optional(),
}).refine(
  (data) => {
    // If role is captain or owner, shopId is required
    if (['captain', 'owner', 'accountant'].includes(data.role)) {
      return !!data.shopId;
    }
    return true;
  },
  {
    message: 'Shop ID is required for captain, owner, or accountant roles',
    path: ['shopId'],
  }
);

/**
 * Schema for searching users
 */
export const searchUsersSchema = z.object({
  search: z
    .string()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
  role: z.enum(USER_ROLES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  year: z.coerce.number().int().min(1).max(4).optional(),
  isApproved: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Schema for approving a user
 */
export const approveUserSchema = z.object({
  initialBalance: z.coerce
    .number()
    .min(0, 'Initial balance cannot be negative')
    .max(100000, 'Initial balance cannot exceed 100,000')
    .optional()
    .default(0),
});

/**
 * Schema for creating a new user (registration)
 */
export const createUserSchema = z.object({
  username: z
    .string({
      required_error: 'Username is required',
    })
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'),
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Please provide a valid email address'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  rollNumber: z
    .string()
    .min(1, 'Roll number is required for students')
    .max(20, 'Roll number cannot exceed 20 characters')
    .optional(),
  department: z.enum(DEPARTMENTS).optional(),
  year: z.coerce.number().int().min(1).max(4).optional(),
});

/**
 * Schema for MongoDB ObjectId validation
 */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

// Type exports
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
export type ApproveUserInput = z.infer<typeof approveUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
