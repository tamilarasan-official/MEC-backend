/**
 * Rate Limiting Middleware
 * Configures rate limiting for different endpoint types
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitConfig, HttpStatus } from '../../config/constants.js';
import { ErrorResponse } from '../types/index.js';
import { recordViolation } from './ip-block.middleware.js';

// ============================================
// RATE LIMIT RESPONSE HANDLER
// ============================================

/**
 * Custom rate limit exceeded handler
 * Also records violation for IP blocking
 */
function rateLimitHandler(req: Request, res: Response): void {
  // Record this violation for potential IP blocking
  const ip = getClientIpForRateLimit(req);
  recordViolation(ip);

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      details: {
        retryAfter: res.getHeader('Retry-After'),
      },
    },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  };

  res.status(HttpStatus.TOO_MANY_REQUESTS).json(response);
}

/**
 * Get client IP for rate limiting (extracted for reuse)
 */
function getClientIpForRateLimit(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  return ip;
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req: Request): boolean {
  // Skip for health check endpoints
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }

  // Skip for internal/trusted requests (e.g., from load balancer)
  const trustedIps = process.env['TRUSTED_IPS']?.split(',') ?? [];
  const clientIp = req.ip ?? '';
  if (trustedIps.includes(clientIp)) {
    return true;
  }

  return false;
}

/**
 * Custom key generator for rate limiting
 */
function keyGenerator(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // Use X-Forwarded-For if behind proxy, otherwise use IP
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';

  return `ip:${ip}`;
}

// ============================================
// BASE RATE LIMITER FACTORY
// ============================================

/**
 * Create a rate limiter with custom options
 */
function createRateLimiter(options: Partial<Options>): RateLimitRequestHandler {
  return rateLimit({
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: rateLimitHandler,
    skip: skipRateLimit,
    keyGenerator,
    ...options,
  });
}

// ============================================
// RATE LIMITERS
// ============================================

/**
 * General API rate limiter
 * Default: 100 requests per 15 minutes
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: RateLimitConfig.GENERAL.windowMs,
  max: RateLimitConfig.GENERAL.maxRequests,
  message: 'Too many requests from this IP, please try again later',
});

/**
 * Auth endpoints rate limiter
 * More strict: 10 requests per 15 minutes
 */
export const authRateLimiter = createRateLimiter({
  windowMs: RateLimitConfig.AUTH.windowMs,
  max: RateLimitConfig.AUTH.maxRequests,
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: false, // Count all requests
});

/**
 * Password reset rate limiter
 * Very strict: 3 requests per hour
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: RateLimitConfig.PASSWORD_RESET.windowMs,
  max: RateLimitConfig.PASSWORD_RESET.maxRequests,
  message: 'Too many password reset attempts, please try again later',
});

/**
 * OTP rate limiter
 * Strict: 5 requests per 10 minutes
 */
export const otpRateLimiter = createRateLimiter({
  windowMs: RateLimitConfig.OTP.windowMs,
  max: RateLimitConfig.OTP.maxRequests,
  message: 'Too many OTP requests, please try again later',
});

/**
 * Admin endpoints rate limiter
 * More lenient for authenticated admins: 200 requests per 15 minutes
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many admin requests, please try again later',
  keyGenerator: (req: Request): string => {
    // Always use user ID for admin endpoints
    if (req.user?.id) {
      return `admin:${req.user.id}`;
    }
    return `admin:${req.ip ?? 'unknown'}`;
  },
});

/**
 * File upload rate limiter
 * Strict: 10 uploads per 10 minutes
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: 'Too many file uploads, please try again later',
});

/**
 * Search/listing rate limiter
 * Moderate: 30 requests per minute
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many search requests, please try again later',
});

/**
 * Order creation rate limiter
 * Moderate: 5 orders per 5 minutes
 */
export const orderRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many order requests, please try again later',
  keyGenerator: (req: Request): string => {
    // Always use user ID for orders
    if (req.user?.id) {
      return `order:${req.user.id}`;
    }
    return `order:${req.ip ?? 'unknown'}`;
  },
});

/**
 * Payment rate limiter
 * Strict: 3 payment attempts per 5 minutes
 */
export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: 'Too many payment attempts, please try again later',
  keyGenerator: (req: Request): string => {
    if (req.user?.id) {
      return `payment:${req.user.id}`;
    }
    return `payment:${req.ip ?? 'unknown'}`;
  },
});

/**
 * Unauthenticated request rate limiter
 * Stricter limits for requests without valid auth tokens
 * 30 requests per 15 minutes
 */
export const unauthenticatedRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many requests. Please authenticate or try again later.',
  keyGenerator: (req: Request): string => {
    // Only apply to unauthenticated requests
    return `unauth:${req.ip ?? 'unknown'}`;
  },
  skip: (req: Request): boolean => {
    // Skip if user is authenticated
    return !!req.user?.id;
  },
});

// ============================================
// DYNAMIC RATE LIMITER
// ============================================

/**
 * Create a custom rate limiter with specific configuration
 */
export function createCustomRateLimiter(
  windowMs: number,
  maxRequests: number,
  message?: string,
  keyPrefix?: string
): RateLimitRequestHandler {
  return createRateLimiter({
    windowMs,
    max: maxRequests,
    message: message ?? 'Too many requests, please try again later',
    keyGenerator: keyPrefix
      ? (req: Request): string => {
          const baseKey = keyGenerator(req);
          return `${keyPrefix}:${baseKey}`;
        }
      : keyGenerator,
  });
}

// ============================================
// SLIDING WINDOW RATE LIMITER
// ============================================

/**
 * In-memory sliding window rate limiter for more precise control
 * Note: For production, consider using Redis for distributed rate limiting
 */
interface SlidingWindowEntry {
  count: number;
  windowStart: number;
}

const slidingWindowStore = new Map<string, SlidingWindowEntry>();

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(slidingWindowStore.entries());
  for (const [key, entry] of entries) {
    // Remove entries older than 1 hour
    if (now - entry.windowStart > 60 * 60 * 1000) {
      slidingWindowStore.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Sliding window rate limiter middleware factory
 */
export function slidingWindowRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyPrefix: string = 'sw'
) {
  return (req: Request, res: Response, next: () => void): void => {
    if (skipRateLimit(req)) {
      return next();
    }

    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const now = Date.now();
    const entry = slidingWindowStore.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      // Start new window
      slidingWindowStore.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      rateLimitHandler(req, res);
      return;
    }

    entry.count++;
    next();
  };
}
