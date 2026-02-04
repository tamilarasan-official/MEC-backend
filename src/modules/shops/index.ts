// Shop Module Exports
export { Shop, IShop, IShopDocument, IShopModel, SHOP_CATEGORIES, ShopCategory } from './shop.model.js';
export {
  createShopSchema,
  updateShopSchema,
  shopIdParamSchema,
  shopQuerySchema,
  CreateShopInput,
  UpdateShopInput,
} from './shop.validation.js';
export { ShopService, shopService } from './shop.service.js';
export { ShopController, shopController } from './shop.controller.js';
export { shopPublicRoutes, shopSuperadminRoutes } from './shop.routes.js';
