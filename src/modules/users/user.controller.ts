import { Request, Response, NextFunction } from 'express';
import { userService, UserError } from './user.service.js';
import {
  updateProfileSchema,
  updateRoleSchema,
  searchUsersSchema,
  approveUserSchema,
  objectIdSchema,
} from './user.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

/**
 * User Controller - Handles HTTP requests for user operations
 */
export class UserController {
  // ============================================
  // STUDENT ROUTES
  // ============================================

  /**
   * Get current user's profile
   * GET /student/profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const user = await userService.getUserById(userId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get student leaderboard
   * GET /student/leaderboard
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse limit from query params (default 50, max 100)
      let limit = 50;
      if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit as string, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 100);
        }
      }

      const leaderboard = await userService.getLeaderboard(limit);

      res.status(HttpStatus.OK).json({
        success: true,
        data: leaderboard,
        meta: {
          count: leaderboard.length,
          limit,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's profile
   * PUT /student/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = updateProfileSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const data = validationResult.data;
      const user = await userService.updateProfile(userId, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  // ============================================
  // ACCOUNTANT ROUTES
  // ============================================

  /**
   * Get pending user approvals
   * GET /accountant/pending-approvals
   */
  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getPendingApprovals();

      res.status(HttpStatus.OK).json({
        success: true,
        data: users,
        meta: {
          count: users.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a user
   * PUT /accountant/approve/:id
   */
  async approveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = approveUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const { initialBalance } = validationResult.data;
      const user = await userService.approveUser(idValidation.data, initialBalance ?? 0);

      logger.info('User approved by accountant', {
        userId: id,
        approvedBy: req.user?.id,
        initialBalance,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        message: 'User approved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Reject a user
   * PUT /accountant/reject/:id
   */
  async rejectUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      await userService.rejectUser(idValidation.data);

      logger.info('User rejected by accountant', {
        userId: id,
        rejectedBy: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'User rejected and removed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all approved students
   * GET /accountant/students
   */
  async getStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate query parameters
      const validationResult = searchUsersSchema.safeParse(req.query);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const result = await userService.getAllStudents(validationResult.data);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific student by ID
   * GET /accountant/students/:id
   */
  async getStudentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      const result = await userService.getUserWithWalletSummary(idValidation.data);

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          user: result.user,
          walletSummary: {
            transactionCount: result.transactionCount,
            totalCredits: result.totalCredits,
            totalDebits: result.totalDebits,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  // ============================================
  // SUPERADMIN ROUTES
  // ============================================

  /**
   * Get all users (superadmin only)
   * GET /superadmin/users
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate query parameters
      const validationResult = searchUsersSchema.safeParse(req.query);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const result = await userService.getAllUsers(validationResult.data);

      res.status(HttpStatus.OK).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role (superadmin only)
   * PUT /superadmin/users/:id/role
   */
  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      // Validate request body
      const validationResult = updateRoleSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.errors,
          },
        });
        return;
      }

      const { role, shopId } = validationResult.data;
      const user = await userService.updateUserRole(idValidation.data, role, shopId);

      logger.info('User role updated by superadmin', {
        userId: id,
        newRole: role,
        shopId,
        updatedBy: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        message: `User role updated to ${role}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Deactivate a user (superadmin only)
   * PUT /superadmin/users/:id/deactivate
   */
  async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      const user = await userService.deactivateUser(idValidation.data);

      logger.info('User deactivated by superadmin', {
        userId: id,
        deactivatedBy: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        message: 'User deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Reactivate a user (superadmin only)
   * PUT /superadmin/users/:id/reactivate
   */
  async reactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      const user = await userService.reactivateUser(idValidation.data);

      logger.info('User reactivated by superadmin', {
        userId: id,
        reactivatedBy: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
        message: 'User reactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Reset user password (superadmin only)
   * PUT /superadmin/users/:id/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body;

      // Validate ID
      const idValidation = objectIdSchema.safeParse(id);
      if (!idValidation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid user ID format',
          },
        });
        return;
      }

      // Validate password
      if (!password || typeof password !== 'string' || password.length < 8) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters long',
          },
        });
        return;
      }

      const user = await userService.resetPassword(idValidation.data, password);

      logger.info('User password reset by superadmin', {
        userId: id,
        resetBy: req.user?.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
        },
        message: 'Password reset successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof UserError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
}

// Export singleton instance
export const userController = new UserController();
