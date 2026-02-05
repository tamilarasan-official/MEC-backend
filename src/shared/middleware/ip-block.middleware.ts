/**
 * IP Blocking Middleware
 * Blocks IPs that repeatedly violate rate limits
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.js';

// Configuration
const MAX_VIOLATIONS = 5; // Number of rate limit violations before blocking
const VIOLATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes - window to count violations
const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour - how long to block
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - cleanup interval

// In-memory stores (for production, use Redis)
interface ViolationRecord {
  count: number;
  firstViolation: number;
}

interface BlockRecord {
  blockedAt: number;
  reason: string;
}

const violationStore = new Map<string, ViolationRecord>();
const blockStore = new Map<string, BlockRecord>();

// Cleanup old records periodically
setInterval(() => {
  const now = Date.now();

  // Clean up old violations
  for (const [ip, record] of violationStore.entries()) {
    if (now - record.firstViolation > VIOLATION_WINDOW_MS) {
      violationStore.delete(ip);
    }
  }

  // Clean up expired blocks
  for (const [ip, record] of blockStore.entries()) {
    if (now - record.blockedAt > BLOCK_DURATION_MS) {
      blockStore.delete(ip);
      logger.info('IP unblocked (expired)', { ip });
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Check if an IP is blocked
 */
export function isIpBlocked(ip: string): boolean {
  const record = blockStore.get(ip);
  if (!record) return false;

  // Check if block has expired
  if (Date.now() - record.blockedAt > BLOCK_DURATION_MS) {
    blockStore.delete(ip);
    return false;
  }

  return true;
}

/**
 * Record a rate limit violation
 */
export function recordViolation(ip: string): void {
  const now = Date.now();
  const record = violationStore.get(ip);

  if (!record || now - record.firstViolation > VIOLATION_WINDOW_MS) {
    // Start new violation window
    violationStore.set(ip, { count: 1, firstViolation: now });
    return;
  }

  // Increment violation count
  record.count++;
  violationStore.set(ip, record);

  // Check if we should block
  if (record.count >= MAX_VIOLATIONS) {
    blockStore.set(ip, {
      blockedAt: now,
      reason: `Exceeded ${MAX_VIOLATIONS} rate limit violations in ${VIOLATION_WINDOW_MS / 60000} minutes`,
    });
    violationStore.delete(ip);
    logger.warn('IP blocked for repeated rate limit violations', {
      ip,
      violations: record.count,
    });
  }
}

/**
 * Middleware to check if IP is blocked
 */
export function checkIpBlock(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);

  // Skip for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  if (isIpBlocked(ip)) {
    const record = blockStore.get(ip);
    const remainingMs = record
      ? BLOCK_DURATION_MS - (Date.now() - record.blockedAt)
      : BLOCK_DURATION_MS;
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    logger.warn('Blocked IP attempted access', { ip, path: req.path });

    res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: `Your IP has been temporarily blocked due to suspicious activity. Please try again in ${remainingMinutes} minutes.`,
      },
    });
    return;
  }

  next();
}

/**
 * Get block statistics (for admin monitoring)
 */
export function getBlockStats(): {
  blockedIps: number;
  activeViolations: number;
} {
  return {
    blockedIps: blockStore.size,
    activeViolations: violationStore.size,
  };
}

/**
 * Manually block an IP (for admin use)
 */
export function manualBlock(ip: string, reason: string): void {
  blockStore.set(ip, {
    blockedAt: Date.now(),
    reason,
  });
  logger.info('IP manually blocked', { ip, reason });
}

/**
 * Manually unblock an IP (for admin use)
 */
export function manualUnblock(ip: string): boolean {
  if (blockStore.has(ip)) {
    blockStore.delete(ip);
    logger.info('IP manually unblocked', { ip });
    return true;
  }
  return false;
}

export default {
  checkIpBlock,
  recordViolation,
  isIpBlocked,
  getBlockStats,
  manualBlock,
  manualUnblock,
};
