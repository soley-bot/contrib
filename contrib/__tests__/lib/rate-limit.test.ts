import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    // Use a unique key prefix per test to avoid cross-test pollution
    vi.restoreAllMocks();
  });

  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it('blocks after exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it('resets after the window expires', () => {
    const key = `test-reset-${Date.now()}`;
    vi.useFakeTimers();

    // Exhaust the limit
    for (let i = 0; i < 2; i++) {
      rateLimit(key, 2, 1_000);
    }
    expect(rateLimit(key, 2, 1_000)).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 2, 1_000)).toBe(true);

    vi.useRealTimers();
  });

  it('uses default limit and window when not specified', () => {
    const key = `test-default-${Date.now()}`;
    // Default is 20 requests / 60s — first call should be allowed
    expect(rateLimit(key)).toBe(true);
  });
});

describe('RATE_LIMITS', () => {
  it('has all expected keys with limit and window', () => {
    const expectedKeys = ['SIGNUP', 'JOIN_LOOKUP', 'REPORT_LOOKUP', 'REPORT_SHARE', 'DEFAULT'];
    for (const name of expectedKeys) {
      const entry = RATE_LIMITS[name as keyof typeof RATE_LIMITS];
      expect(entry).toHaveProperty('limit');
      expect(entry).toHaveProperty('window');
      expect(entry.limit).toBeGreaterThan(0);
      expect(entry.window).toBeGreaterThan(0);
    }
  });

  it('SIGNUP limit is 5 per minute', () => {
    expect(RATE_LIMITS.SIGNUP).toEqual({ limit: 5, window: 60_000 });
  });
});

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for string', () => {
    expect(getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
  });

  it('extracts IP from x-forwarded-for array', () => {
    expect(getClientIp({ 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] })).toBe('10.0.0.1');
  });

  it('returns unknown when no forwarded header', () => {
    expect(getClientIp({})).toBe('unknown');
  });

  it('trims whitespace from forwarded IP', () => {
    expect(getClientIp({ 'x-forwarded-for': '  9.8.7.6 , 1.1.1.1' })).toBe('9.8.7.6');
  });
});
