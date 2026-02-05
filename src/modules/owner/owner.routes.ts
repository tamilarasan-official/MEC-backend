/**
 * Owner Routes
 * Routes for shop owners to manage their shop staff (captains)
 */

import { Router } from 'express';
import { ownerController } from './owner.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate, validateParams } from '../../shared/middleware/validate.middleware.js';
import { createCaptainSchema, captainIdParamSchema } from './owner.validation.js';

export const ownerRoutes = Router();

// All owner routes require owner role
ownerRoutes.use(requireAuth('owner'));

// POST /owner/captains - Create a new captain
ownerRoutes.post(
  '/captains',
  validate(createCaptainSchema),
  (req, res, next) => ownerController.createCaptain(req, res, next)
);

// GET /owner/captains - List all captains for the owner's shop
ownerRoutes.get('/captains', (req, res, next) => ownerController.getCaptains(req, res, next));

// DELETE /owner/captains/:id - Remove a captain (deactivate)
ownerRoutes.delete(
  '/captains/:id',
  validateParams(captainIdParamSchema),
  (req, res, next) => ownerController.removeCaptain(req, res, next)
);

// GET /owner/shop - Get owner's shop details
ownerRoutes.get('/shop', (req, res, next) => ownerController.getShopDetails(req, res, next));

export default ownerRoutes;
