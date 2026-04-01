/**
 * Simple in-memory rate limiter for API routes.
 * Fine for single-instance deployments (Vercel serverless).
 * Upgrade to Upstash Redis for distributed rate limiting later.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, record] of store) {
    if (now > record.resetAt) store.delete(key);
  }
}

/**
 * Check if a request should be allowed.
 * @param key - Unique identifier (e.g., IP address or user ID)
 * @param limit - Max requests allowed in the window (default: 20)
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns true if allowed, false if rate limited
 */
export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  cleanup();
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) return false;
  record.count++;
  return true;
}

export const RATE_LIMITS = {
  SIGNUP: { limit: 5, window: 60_000 },
  JOIN_LOOKUP: { limit: 30, window: 60_000 },
  REPORT_LOOKUP: { limit: 20, window: 60_000 },
  REPORT_SHARE: { limit: 10, window: 60_000 },
  DEFAULT: { limit: 10, window: 60_000 },
} as const;

/**
 * Extract client IP from Next.js API request headers.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  // Prefer x-real-ip (set by Vercel, cannot be forged by clients)
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return 'unknown';
}
