import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: () => '127.0.0.1',
  RATE_LIMITS: { DEFAULT: { limit: 60, window: '1 m' } },
}));

const authState = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('@/lib/supabase-server', () => ({
  getUserFromApiRoute: vi.fn(async () => authState.user),
}));

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockFrom = vi.fn((_table?: string) => ({ select: mockSelect }));
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed/abc' }, error: null });
vi.mock('@/lib/supabase-admin', () => ({
  adminClient: {
    from: (table: string) => mockFrom(table),
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}));

import handler from '@/pages/api/evidence/download-url';

function makeReqRes(method = 'GET', query: Record<string, string> = {}) {
  const req = { method, headers: {}, query } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn(() => ({ json, end: vi.fn() }));
  const res = { status, json, end: vi.fn() } as unknown as NextApiResponse;
  return { req, res, status, json };
}

describe('GET /api/evidence/download-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1' };
  });

  it('405 for non-GET', async () => {
    const { req, res, status } = makeReqRes('POST', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('401 when unauthenticated', async () => {
    authState.user = null;
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('400 when id missing', async () => {
    const { req, res, status } = makeReqRes('GET', {});
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('404 when evidence not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('400 when evidence has no file_path (legacy URL row)', async () => {
    // Authorization runs BEFORE the file_path check, so this test needs a successful
    // member lookup to reach the 400.
    mockSingle
      .mockResolvedValueOnce({
        data: { id: 'e1', task_id: 't1', file_path: null, tasks: { group_id: 'g1' } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: 'm1' }, error: null });
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('404 (unified) when caller is neither group member nor course teacher', async () => {
    // Returns 404 instead of 403 to avoid leaking existence of evidence the caller
    // isn't authorized to see.
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'e1', task_id: 't1', file_path: 'g1/t1/e1-x.pdf', tasks: { group_id: 'g1' } }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('200 with signedUrl for a group member', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'e1', task_id: 't1', file_path: 'g1/t1/e1-x.pdf', tasks: { group_id: 'g1' } }, error: null })
      .mockResolvedValueOnce({ data: { id: 'm1' }, error: null });
    const { req, res, status, json } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ url: 'https://signed/abc' });
  });
});
