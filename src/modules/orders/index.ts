/**
 * Orders Module
 * Export all order-related components
 */

// Model
export { Order, IOrder, IOrderDocument, IOrderModel, IOrderItem, OrderStatus, ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } from './order.model.js';

// Validation
export {
  createOrderSchema,
  updateStatusSchema,
  verifyQrSchema,
  orderQuerySchema,
  orderIdParamSchema,
  cancelOrderSchema,
  validateSchema,
  validateCreateOrder,
  validateUpdateStatus,
  validateVerifyQr,
  validateOrderQuery,
  validateOrderIdParam,
  validateCancelOrder,
  type CreateOrderInput,
  type UpdateStatusInput,
  type VerifyQrInput,
  type OrderQueryInput,
  type OrderIdParam,
  type CancelOrderInput,
} from './order.validation.js';

// Service
export { OrderService, orderService, type OrderResult, type PaginatedOrders, type QrPayload } from './order.service.js';

// Controller
export { OrderController, orderController } from './order.controller.js';

// Routes
export { default as orderRoutes } from './order.routes.js';
export { orderRoutes as orderRouter } from './order.routes.js';

// Events
export { OrderEvents, orderEvents, ORDER_EVENTS } from './order.events.js';
