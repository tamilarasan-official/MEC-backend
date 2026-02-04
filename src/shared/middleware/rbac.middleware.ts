/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles role and permission-based authorization
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission, AuthUser } from '../types/index.js';
import { AppError } from './error.middleware.js';
import { HttpStatus } from '../../config/constants.js';

// ============================================
// ROLE HIERARCHY
// ============================================

/**
 * Role hierarchy - higher roles inherit permissions from lower roles
 * Updated to match the application's user model roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  captain: 2,
  owner: 3,
  accountant: 4,
  superadmin: 5,
};

// ============================================
// ROLE PERMISSIONS MAPPING
// ============================================

/**
 * Permissions assigned to each role
 * Updated to match the application's user model roles
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [
    'user:read',
    'order:read',
    'order:write',
    'order:cancel',
    'shop:read',
    'menu:read',
    'wallet:read',
    'wallet:write',
  ],
  captain: [
    'user:read',
    'order:read',
    'order:write',
    'order:manage',
    'shop:read',
    'menu:read',
    'menu:write',
    'wallet:read',
  ],
  owner: [
    'user:read',
    'user:write',
    'order:read',
    'order:write',
    'order:manage',
    'shop:read',
    'shop:write',
    'menu:read',
    'menu:write',
    'menu:delete',
    'wallet:read',
    'wallet:write',
  ],
  accountant: [
    'user:read',
    'user:write',
    'user:manage',
    'order:read',
    'order:manage',
    'shop:read',
    'wallet:read',
    'wallet:write',
    'wallet:manage',
    'admin:read',
  ],
  superadmin: [
    'user:read',
    'user:write',
    'user:delete',
    'user:manage',
    'order:read',
    'order:write',
    'order:cancel',
    'order:manage',
    'shop:read',
    'shop:write',
    'shop:delete',
    'shop:manage',
    'menu:read',
    'menu:write',
    'menu:delete',
    'wallet:read',
    'wallet:write',
    'wallet:manage',
    'admin:read',
    'admin:write',
    'admin:manage',
    'system:config',
    'system:logs',
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a user has any of the specified roles
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if a user's role is at least as high as the required role
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Middleware to require specific roles
 * @param roles - Array of allowed roles
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!hasRole(user.role, roles)) {
      return next(
        new AppError(
          `Access denied. Required roles: ${roles.join(', ')}`,
          HttpStatus.FORBIDDEN,
          'INSUFFICIENT_ROLE',
          true,
          { requiredRoles: roles, userRole: user.role }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require minimum role level
 * @param minimumRole - Minimum role required
 */
export function requireMinimumRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!hasMinimumRole(user.role, minimumRole)) {
      return next(
        new AppError(
          `Access denied. Minimum role required: ${minimumRole}`,
          HttpStatus.FORBIDDEN,
          'INSUFFICIENT_ROLE_LEVEL',
          true,
          { minimumRole, userRole: user.role }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 * @param permission - Required permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!hasPermission(user.role, permission)) {
      return next(
        new AppError(
          `Access denied. Required permission: ${permission}`,
          HttpStatus.FORBIDDEN,
          'INSUFFICIENT_PERMISSION',
          true,
          { requiredPermission: permission, userRole: user.role }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require any of the specified permissions
 * @param permissions - Array of permissions (user needs at least one)
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const hasAnyPermission = permissions.some((permission) =>
      hasPermission(user.role, permission)
    );

    if (!hasAnyPermission) {
      return next(
        new AppError(
          `Access denied. Required one of permissions: ${permissions.join(', ')}`,
          HttpStatus.FORBIDDEN,
          'INSUFFICIENT_PERMISSION',
          true,
          { requiredPermissions: permissions, userRole: user.role }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require all specified permissions
 * @param permissions - Array of permissions (user needs all)
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const missingPermissions = permissions.filter(
      (permission) => !hasPermission(user.role, permission)
    );

    if (missingPermissions.length > 0) {
      return next(
        new AppError(
          `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
          HttpStatus.FORBIDDEN,
          'INSUFFICIENT_PERMISSIONS',
          true,
          { missingPermissions, userRole: user.role }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to check if user belongs to the specified shop
 * Used for vendor/captain access control
 */
export function checkShopAccess(shopIdParam: string = 'shopId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Superadmins and accountants have access to all shops
    if (hasMinimumRole(user.role, 'accountant')) {
      return next();
    }

    // Get shop ID from params, body, or query
    const shopId =
      req.params[shopIdParam] ||
      (req.body as Record<string, unknown>)?.[shopIdParam] ||
      (req.query[shopIdParam] as string);

    if (!shopId) {
      return next(AppError.badRequest('Shop ID is required'));
    }

    // Check if user's shop matches the requested shop
    if (!user.shopId || user.shopId !== shopId) {
      return next(
        new AppError(
          'You do not have access to this shop',
          HttpStatus.FORBIDDEN,
          'SHOP_ACCESS_DENIED',
          true,
          { requestedShopId: shopId }
        )
      );
    }

    next();
  };
}

/**
 * Middleware to check if user owns the resource or is admin
 * @param userIdParam - Parameter name containing the user ID to check
 */
export function checkOwnershipOrAdmin(userIdParam: string = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Accountants and superadmins have access
    if (hasMinimumRole(user.role, 'accountant')) {
      return next();
    }

    // Get user ID from params
    const resourceUserId = req.params[userIdParam];

    if (!resourceUserId) {
      return next(AppError.badRequest('User ID is required'));
    }

    // Check if user owns the resource
    if (user.id !== resourceUserId) {
      return next(
        new AppError(
          'You do not have access to this resource',
          HttpStatus.FORBIDDEN,
          'OWNERSHIP_DENIED',
          true
        )
      );
    }

    next();
  };
}

/**
 * Middleware to check if user is the resource owner
 * Strictly checks ownership, even admins must be owners
 */
export function checkStrictOwnership(userIdParam: string = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const resourceUserId = req.params[userIdParam];

    if (!resourceUserId) {
      return next(AppError.badRequest('User ID is required'));
    }

    if (user.id !== resourceUserId) {
      return next(
        new AppError(
          'Only the resource owner can perform this action',
          HttpStatus.FORBIDDEN,
          'OWNERSHIP_REQUIRED',
          true
        )
      );
    }

    next();
  };
}
