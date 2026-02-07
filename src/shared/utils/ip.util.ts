/**
 * IP Address Utility
 * Single source of truth for extracting the real client IP address.
 * Handles reverse proxies (Nginx, Cloudflare, etc.) by checking
 * proxy headers before falling back to req.ip.
 */

import { Request } from 'express';

/**
 * Strip ::ffff: prefix from IPv4-mapped IPv6 addresses
 */
function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Check if an IP is a private/internal address
 */
function isPrivateIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  return (
    normalized === '127.0.0.1' ||
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('172.16.') || normalized.startsWith('172.17.') ||
    normalized.startsWith('172.18.') || normalized.startsWith('172.19.') ||
    normalized.startsWith('172.20.') || normalized.startsWith('172.21.') ||
    normalized.startsWith('172.22.') || normalized.startsWith('172.23.') ||
    normalized.startsWith('172.24.') || normalized.startsWith('172.25.') ||
    normalized.startsWith('172.26.') || normalized.startsWith('172.27.') ||
    normalized.startsWith('172.28.') || normalized.startsWith('172.29.') ||
    normalized.startsWith('172.30.') || normalized.startsWith('172.31.') ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('169.254.') ||
    normalized.startsWith('fc00:') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

/**
 * Extract the real client IP from the request.
 *
 * Priority:
 * 1. CF-Connecting-IP  (Cloudflare)
 * 2. X-Real-IP         (Nginx proxy_set_header)
 * 3. X-Forwarded-For   (scan for first public IP, then fall back to first entry)
 * 4. req.ip            (Express, respects trust proxy)
 * 5. req.socket.remoteAddress
 * 6. 'unknown'
 */
export function getClientIp(req: Request): string {
  // Cloudflare always sets this to the true client IP
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp) {
    return normalizeIp(cfIp);
  }

  // Nginx commonly sets X-Real-IP to the client IP
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) {
    return normalizeIp(realIp);
  }

  // Standard proxy header — scan the chain for the first public IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const ips = raw.split(',').map(ip => normalizeIp(ip)).filter(Boolean);

    // Prefer the first public IP in the chain
    const publicIp = ips.find(ip => !isPrivateIp(ip));
    if (publicIp) return publicIp;

    // Fall back to first IP in chain if all are private
    if (ips.length > 0) return ips[0];
  }

  // Express-parsed IP (uses trust proxy setting)
  if (req.ip) {
    return normalizeIp(req.ip);
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) return normalizeIp(socketIp);

  return 'unknown';
}
