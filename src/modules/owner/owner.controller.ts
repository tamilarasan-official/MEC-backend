/**
 * Owner Controller
 * Handles owner operations like captain management
 */

import { Request, Response, NextFunction } from 'express';
import { ownerService } from './owner.service.js';
import { createCaptainSchema, captainIdParamSchema } from './owner.validation.js';
import { HttpStatus } from '../../config/constants.js';
import { AppError } from '../../shared/middleware/error.middleware.js';
import { logger } from '../../config/logger.js';

interface AuthUser {
  id: string;
  role: string;
  shopId?: string;
}

export class OwnerController {
  /**
   * POST /owner/captains - Create a new captain for the owner's shop
   */
  async createCaptain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;

      if (!user.shopId) {
        throw new AppError('You are not assigned to a shop', HttpStatus.FORBIDDEN);
      }

      const bodyResult = createCaptainSchema.safeParse(req.body);

      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const captain = await ownerService.createCaptain(user.shopId, bodyResult.data);

      logger.info('Captain created by owner', {
        captainId: captain.id,
        captainEmail: captain.email,
        shopId: user.shopId,
        ownerId: user.id,
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: captain,
        message: 'Captain created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Handle duplicate email error
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(HttpStatus.CONFLICT).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /owner/captains - List all captains for the owner's shop
   */
  async getCaptains(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;

      if (!user.shopId) {
        throw new AppError('You are not assigned to a shop', HttpStatus.FORBIDDEN);
      }

      const captains = await ownerService.getCaptains(user.shopId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: { captains },
        meta: { count: captains.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /owner/captains/:id - Remove a captain (deactivate)
   */
  async removeCaptain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;

      if (!user.shopId) {
        throw new AppError('You are not assigned to a shop', HttpStatus.FORBIDDEN);
      }

      const paramResult = captainIdParamSchema.safeParse(req.params);

      if (!paramResult.success) {
        throw new AppError('Invalid captain ID format', HttpStatus.BAD_REQUEST);
      }

      await ownerService.removeCaptain(user.shopId, paramResult.data.id);

      logger.info('Captain removed by owner', {
        captainId: paramResult.data.id,
        shopId: user.shopId,
        ownerId: user.id,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Captain removed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /owner/shop - Get owner's shop details
   */
  async getShopDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;

      if (!user.shopId) {
        throw new AppError('You are not assigned to a shop', HttpStatus.FORBIDDEN);
      }

      const shop = await ownerService.getShopDetails(user.shopId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: shop,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ownerController = new OwnerController();
export default ownerController;
