import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';

// Redis is only instantiated if both env vars are present. In local dev
// without Upstash credentials, rate limiting fails open (see rateLimit).
const redisConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const redis = redisConfigured
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

/**
 * Sliding-window rate limiters backed by Upstash Redis.
 * Shared across all serverless instances — no cold-start resets.
 */
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: true,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

// Warn once at startup if running without Redis — visible in dev server logs.
let warnedMissingRedis = false;

/**
 * Check if a request should be allowed.
 * Fails open on infrastructure errors: if Redis is unreachable or unconfigured,
 * requests are allowed and the error is logged to Sentry. A broken rate limiter
 * must never return 500 across all API routes.
 * @param key - Unique identifier (e.g., "signup:192.168.1.1")
 * @param limit - Max requests allowed in the window (default: 20)
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns true if allowed, false if rate limited
 */
export async function rateLimit(key: string, limit = 20, windowMs = 60_000): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) {
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      // eslint-disable-next-line no-console
      console.warn('[rate-limit] Upstash Redis not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing). Rate limiting disabled.');
    }
    return true;
  }
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'rate-limit' } });
    return true;
  }
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
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return 'unknown';
}
