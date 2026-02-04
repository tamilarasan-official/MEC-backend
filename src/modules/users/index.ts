/**
 * Users Module - Main Export
 */

export { User } from './user.model.js';
export type { IUser, IUserDocument, IUserModel, UserRole, Department, Year, IFcmToken } from './user.model.js';
export { USER_ROLES, DEPARTMENTS, YEARS } from './user.model.js';

export { userService, UserError } from './user.service.js';
export type { SearchUsersParams, UpdateProfileData, PaginatedUsers } from './user.service.js';

export { userController } from './user.controller.js';

export {
  updateProfileSchema,
  updateRoleSchema,
  searchUsersSchema,
  approveUserSchema,
  createUserSchema,
  objectIdSchema,
} from './user.validation.js';
export type {
  UpdateProfileInput,
  UpdateRoleInput,
  SearchUsersInput,
  ApproveUserInput,
  CreateUserInput,
} from './user.validation.js';

export { default as userRoutes } from './user.routes.js';
