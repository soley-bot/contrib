import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock rate limit (always pass)
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: () => '127.0.0.1',
  RATE_LIMITS: { DEFAULT: { limit: 60, window: '1 m' } },
}));

// Mock auth — returns a user id by default; null when `returnNullUser` set
const authState = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('@/lib/supabase-server', () => ({
  getUserFromApiRoute: vi.fn(async () => authState.user),
}));

// Mock adminClient with a chainable thenable
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockIs = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, is: mockIs, single: mockSingle, maybeSingle: mockMaybeSingle, order: mockOrder, limit: mockLimit }));
const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) }));
const mockFrom = vi.fn((_table?: string) => ({ select: mockSelect, insert: mockInsert }));
vi.mock('@/lib/supabase-admin', () => ({
  adminClient: { from: (table: string) => mockFrom(table), storage: { from: vi.fn() } },
}));

// Mock formidable so no real filesystem IO happens
vi.mock('formidable', () => ({
  default: () => ({
    parse: (_req: unknown, cb: (err: Error | null, fields: Record<string, string[]>, files: Record<string, unknown>) => void) =>
      cb(null, { type: ['note'], task_id: ['11111111-1111-4111-8111-111111111111'], content: ['ok'] }, {}),
  }),
}));

import handler from '@/pages/api/evidence/create';

function makeReqRes(method = 'POST') {
  const req = { method, headers: {}, on: vi.fn(), pipe: vi.fn() } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn(() => ({ json, end: vi.fn() }));
  const res = { status, json, end: vi.fn() } as unknown as NextApiResponse;
  return { req, res, status, json };
}

describe('POST /api/evidence/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1' };
  });

  it('returns 405 for non-POST', async () => {
    const { req, res, status } = makeReqRes('GET');
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.user = null;
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when task does not exist', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });  // tasks lookup
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not a group member', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 't1', group_id: 'g1' }, error: null })   // tasks lookup
      .mockResolvedValueOnce({ data: null, error: null });                          // group_members check
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(403);
  });
});
