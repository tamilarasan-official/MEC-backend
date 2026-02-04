// Menu Module Exports

// Models
export {
  Category,
  ICategory,
  ICategoryDocument,
  ICategoryModel,
} from './category.model.js';

export {
  FoodItem,
  IFoodItem,
  IFoodItemDocument,
  IFoodItemModel,
} from './food-item.model.js';

// Validation schemas and types
export {
  createCategorySchema,
  updateCategorySchema,
  createFoodItemSchema,
  updateFoodItemSchema,
  setOfferSchema,
  shopIdParamSchema,
  menuItemIdParamSchema,
  categoryIdParamSchema,
  menuQuerySchema,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateFoodItemInput,
  UpdateFoodItemInput,
  SetOfferInput,
  ShopIdParam,
  MenuItemIdParam,
  CategoryIdParam,
  MenuQuery,
} from './menu.validation.js';

// Service
export { MenuService, menuService } from './menu.service.js';

// Controller
export { MenuController, menuController } from './menu.controller.js';

// Routes
export { menuPublicRoutes, menuOwnerRoutes, menuSuperadminRoutes } from './menu.routes.js';
