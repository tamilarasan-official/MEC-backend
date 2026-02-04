import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RateLimitConfig, HttpStatus, ErrorMessages } from './config/constants.js';
import { logger } from './config/logger.js';
import { getDatabaseStatus } from './config/database.js';

// Import route modules
import authRoutes from './modules/auth/auth.routes.js';
import walletRoutes from './modules/wallet/wallet.routes.js';
import userRoutes from './modules/users/user.routes.js';
import { shopPublicRoutes, shopSuperadminRoutes } from './modules/shops/shop.routes.js';
import { menuGlobalRoutes, menuPublicRoutes, menuOwnerRoutes, menuSuperadminRoutes } from './modules/menu/menu.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import { superadminRoutes } from './modules/superadmin/index.js';
import { uploadRoutes } from './modules/uploads/index.js';

// Import shared error class
import { AppError } from './shared/middleware/error.middleware.js';

// Re-export AppError for backwards compatibility
export { AppError };

// Create Express app
const app: Express = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const corsOrigins = process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000', 'http://localhost:5173'];
app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: RateLimitConfig.GENERAL.windowMs,
  max: RateLimitConfig.GENERAL.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: ErrorMessages.RATE_LIMIT_EXCEEDED,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
});

app.use(generalLimiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MEC Food App API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/api/v1/docs',
    },
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();

  const healthStatus = {
    status: dbStatus.isConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
    database: {
      status: dbStatus.readyStateText,
      connected: dbStatus.isConnected,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  const statusCode = dbStatus.isConnected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
  res.status(statusCode).json(healthStatus);
});

// API version prefix
const API_VERSION = '/api/v1';

// API root endpoint
app.get(`${API_VERSION}`, (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MEC Food App API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
  });
});

// Register route modules
// Auth routes
app.use(`${API_VERSION}/auth`, authRoutes);

// Public routes
app.use(`${API_VERSION}/shops`, shopPublicRoutes);
app.use(`${API_VERSION}/shops/:shopId`, menuPublicRoutes);

// Global menu routes (public)
app.use(`${API_VERSION}/menu`, menuGlobalRoutes);

// Protected routes
app.use(API_VERSION, walletRoutes);
app.use(API_VERSION, userRoutes);
app.use(`${API_VERSION}/orders`, orderRoutes);

// Owner routes
app.use(`${API_VERSION}/owner`, menuOwnerRoutes);

// Superadmin routes
app.use(`${API_VERSION}/superadmin/shops`, shopSuperadminRoutes);
app.use(`${API_VERSION}/superadmin`, menuSuperadminRoutes);
app.use(`${API_VERSION}/superadmin`, superadminRoutes);

// Upload routes
app.use(`${API_VERSION}/uploads`, uploadRoutes);

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(ErrorMessages.NOT_FOUND, HttpStatus.NOT_FOUND));
});

// Global error handler
app.use((err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
  // Default error values
  let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
  let message: string = ErrorMessages.INTERNAL_ERROR;
  let code: string = 'INTERNAL_ERROR';
  let isOperational = false;

  // Handle known errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    isOperational = err.isOperational;
  }

  // Log error
  if (!isOperational) {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Operational error:', {
      error: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Send error response (hide stack trace in production)
  const isProduction = process.env['NODE_ENV'] === 'production';
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(!isProduction && {
        stack: err.stack,
        details: err.message,
      }),
    },
  });
});

export default app;
