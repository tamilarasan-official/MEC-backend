import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
import imageProxyRoutes from './modules/uploads/image-proxy.routes.js';
import { adhocPaymentsSuperadminRoutes, adhocPaymentsStudentRoutes } from './modules/adhoc-payments/index.js';
import { ownerRoutes } from './modules/owner/index.js';

// Import shared error class
import { AppError } from './shared/middleware/error.middleware.js';

// Import CSRF middleware
import { csrfProtection } from './shared/middleware/csrf.middleware.js';

// Import IP blocking middleware
import { checkIpBlock } from './shared/middleware/ip-block.middleware.js';

// Re-export AppError for backwards compatibility
export { AppError };

// Create Express app
const app: Express = express();

// Helper function to check if origin is allowed
// Uses proper hostname parsing to prevent bypass attacks
function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    // Allow localhost for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Allow exact domain
    if (hostname === 'welocalhost.com') {
      return true;
    }

    // Allow subdomains (must end with .welocalhost.com)
    if (hostname.endsWith('.welocalhost.com')) {
      // Prevent subdomain takeover patterns like evil.com.welocalhost.com
      // by ensuring no additional dots before welocalhost.com
      const subdomain = hostname.slice(0, -'.welocalhost.com'.length);
      if (subdomain.length > 0 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(subdomain)) {
        return true;
      }
    }

    return false;
  } catch {
    // Invalid URL
    return false;
  }
}

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// HTTPS redirect in production
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip for health checks and localhost
  if (req.path === '/health' || req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }

  // Redirect HTTP to HTTPS in production
  if (process.env['NODE_ENV'] === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  next();
});

// Helper function to set all CORS headers
function setCorsHeaders(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token');
  // Expose X-CSRF-Token so frontend can read it from cross-origin responses
  // (fallback when browser blocks the csrf_token cookie)
  res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
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
    // Allow requests with no origin (server-to-server, same-origin)
    if (!origin) {
      return callback(null, true);
    }
    // Use the same isAllowedOrigin function for consistency
    if (isAllowedOrigin(origin)) {
      return callback(null, origin);
    }
    logger.warn('CORS blocked origin', { origin });
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware - AFTER CORS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Next.js
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.welocalhost.com"],
        connectSrc: ["'self'", "https://*.welocalhost.com", "wss://*.welocalhost.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for loading external images
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for API
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware (for httpOnly refresh token cookies)
app.use(cookieParser());

// IP blocking middleware - check if IP is blocked before processing requests
app.use(checkIpBlock);

// CSRF protection for API routes
// Generates token on all requests, validates on state-changing requests (POST, PUT, PATCH, DELETE)
app.use('/api/v1', csrfProtection);

// General rate limiting
// Uses a smart key: authenticated users are keyed by user ID (from JWT),
// unauthenticated requests are keyed by IP.
// This is critical for campus networks where hundreds of students share one public IP.
function extractUserIdFromToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.slice(7);
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.id || decoded.sub || null;
  } catch {
    return null;
  }
}

// Authenticated users: per-user limit (80 req / 15 min)
const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: ErrorMessages.RATE_LIMIT_EXCEEDED,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = extractUserIdFromToken(req);
    return `user:${userId}`;
  },
  skip: (req: Request) => {
    if (req.path === '/health') return true;
    // Skip if no valid token — the unauthenticated limiter handles those
    return !extractUserIdFromToken(req);
  },
});

// Unauthenticated requests: stricter IP-based limit (50 req / 15 min)
const unauthenticatedLimiter = rateLimit({
  windowMs: RateLimitConfig.GENERAL.windowMs,
  max: 50,
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
    if (req.path === '/health') return true;
    // Skip if authenticated — the authenticated limiter handles those
    return !!extractUserIdFromToken(req);
  },
});

app.use(authenticatedLimiter);
app.use(unauthenticatedLimiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Silently handle browser extension requests (password managers, etc.)
app.get('/enc.js', (_req: Request, res: Response) => {
  res.status(204).end();
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

// Version endpoint - minimal info for production
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    success: true,
    version: '1.5.0',
    status: 'operational',
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
app.use(`${API_VERSION}/owner`, ownerRoutes);

// Superadmin routes
app.use(`${API_VERSION}/superadmin/shops`, shopSuperadminRoutes);
app.use(`${API_VERSION}/superadmin`, menuSuperadminRoutes);
app.use(`${API_VERSION}/superadmin`, superadminRoutes);
app.use(`${API_VERSION}/superadmin/payments`, adhocPaymentsSuperadminRoutes);

// Student ad-hoc payments routes
app.use(`${API_VERSION}/student/payments`, adhocPaymentsStudentRoutes);

// Upload routes
app.use(`${API_VERSION}/uploads`, uploadRoutes);

// Image proxy routes (public - for accessing Garage S3 images)
app.use(`${API_VERSION}/images`, imageProxyRoutes);

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
  let details: Record<string, unknown> | unknown[] | undefined;

  // Handle known errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    isOperational = err.isOperational;
    details = err.details;
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

  // Send error response
  // Include validation details for VALIDATION_ERROR (safe to expose)
  // Hide stack trace unless explicitly in development
  const isDev = process.env['NODE_ENV'] === 'development';
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      // Always include validation details - they help users fix their input
      ...(details && { details }),
      // Only include stack in development
      ...(isDev && { stack: err.stack }),
    },
  });
});

export default app;
