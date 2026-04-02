import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @upstash/redis before importing rate-limit
vi.mock('@upstash/redis', () => {
  return { Redis: class MockRedis {} };
});

// Mock @upstash/ratelimit
const mockLimit = vi.fn();
vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow() { return 'sliding-window-config'; }
  }
  return { Ratelimit: MockRatelimit };
});

import { rateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it('returns true when under the limit', async () => {
    mockLimit.mockResolvedValue({ success: true });
    expect(await rateLimit('test-key', 5, 60_000)).toBe(true);
    expect(mockLimit).toHaveBeenCalledWith('test-key');
  });

  it('returns false when over the limit', async () => {
    mockLimit.mockResolvedValue({ success: false });
    expect(await rateLimit('test-key', 5, 60_000)).toBe(false);
  });

  it('uses default limit and window when not specified', async () => {
    mockLimit.mockResolvedValue({ success: true });
    expect(await rateLimit('test-default')).toBe(true);
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
