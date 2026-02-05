import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { RateLimitConfig, HttpStatus, ErrorMessages } from './config/constants.js';
import { logger } from './config/logger.js';
import { getDatabaseStatus } from './config/database.js';
import { swaggerSpec } from './config/swagger.js';

// Import route modules
import authRoutes from './modules/auth/auth.routes.js';
import walletRoutes from './modules/wallet/wallet.routes.js';
import userRoutes from './modules/users/user.routes.js';
import { shopPublicRoutes, shopSuperadminRoutes } from './modules/shops/shop.routes.js';
import { menuGlobalRoutes, menuPublicRoutes, menuOwnerRoutes, menuSuperadminRoutes } from './modules/menu/menu.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import { superadminRoutes } from './modules/superadmin/index.js';
import { uploadRoutes } from './modules/uploads/index.js';
import { adhocPaymentsSuperadminRoutes, adhocPaymentsStudentRoutes } from './modules/adhoc-payments/index.js';

// Import shared error class
import { AppError } from './shared/middleware/error.middleware.js';

// Re-export AppError for backwards compatibility
export { AppError };

// Create Express app
const app: Express = express();

// Helper function to check if origin is allowed
function isAllowedOrigin(origin: string): boolean {
  return origin.includes('welocalhost.com') || origin.includes('localhost') || origin.includes('127.0.0.1');
}

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Helper function to set all CORS headers
function setCorsHeaders(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// SIMPLE CORS - Allow all welocalhost.com subdomains AND localhost
// This runs BEFORE everything else
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Allow all welocalhost.com subdomains AND localhost for development
  if (origin && isAllowedOrigin(origin)) {
    setCorsHeaders(res, origin);
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

// Also use cors middleware as backup
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin
    if (!origin) {
      return callback(null, true);
    }
    // Allow all welocalhost.com subdomains
    if (origin.includes('welocalhost.com')) {
      return callback(null, origin);
    }
    // Allow localhost in development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, origin);
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware - AFTER CORS
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to avoid conflicts
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
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
    version: '1.5.0',
    endpoints: {
      health: '/health',
      version: '/version',
      api: '/api/v1',
      swagger: '/swagger',
      swaggerJson: '/swagger.json',
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

// Version/debug endpoint - helps verify which code is deployed
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    success: true,
    version: '1.5.0',
    buildDate: '2026-02-05',
    features: [
      'route-ordering-fix',
      'owner-role-accountant-access',
      'jwt-env-config',
      'cors-fix-all-origins',
      'superadmin-menu-endpoint',
      'swagger-documentation',
      'full-cors-headers-on-errors',
    ],
    cors: {
      allowedPatterns: ['*.welocalhost.com', 'localhost (dev)'],
      allowedDomains: ['meclife.welocalhost.com', 'api.mecfoodapp.welocalhost.com'],
    },
    routes: {
      auth: {
        login: 'POST /api/v1/auth/login',
        register: 'POST /api/v1/auth/register',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout',
        me: 'GET /api/v1/auth/me',
      },
      menu: {
        items: 'GET /api/v1/menu/items',
        offers: 'GET /api/v1/menu/offers',
      },
      shops: {
        list: 'GET /api/v1/shops',
        details: 'GET /api/v1/shops/:id',
      },
      superadmin: {
        menu: 'GET /api/v1/superadmin/menu (all items including unavailable)',
        shops: 'POST/PUT/DELETE /api/v1/superadmin/shops',
        users: 'GET /api/v1/superadmin/users',
        stats: 'GET /api/v1/superadmin/dashboard/stats',
      },
    },
  });
});

// API version prefix
const API_VERSION = '/api/v1';

// Swagger API Documentation
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { font-size: 2.5em; }
  `,
  customSiteTitle: 'MEC Food App API Docs',
  customfavIcon: '/favicon.ico',
}));

// Serve swagger spec as JSON
app.get('/swagger.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API root endpoint
app.get(`${API_VERSION}`, (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MEC Food App API',
    version: '1.0.0',
    documentation: '/swagger',
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
app.use(`${API_VERSION}/superadmin/payments`, adhocPaymentsSuperadminRoutes);

// Student ad-hoc payments routes
app.use(`${API_VERSION}/student/payments`, adhocPaymentsStudentRoutes);

// Upload routes
app.use(`${API_VERSION}/uploads`, uploadRoutes);

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(ErrorMessages.NOT_FOUND, HttpStatus.NOT_FOUND));
});

// Global error handler - ensure CORS headers are always sent
app.use((err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
  // Ensure ALL CORS headers are set on error responses
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    setCorsHeaders(res, origin);
  }

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
      origin: origin,
    });
  } else {
    logger.warn('Operational error:', {
      error: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Send error response (hide stack trace in production)
  const isProd = process.env['NODE_ENV'] === 'production';
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(!isProd && {
        stack: err.stack,
        details: err.message,
      }),
    },
  });
});

export default app;
