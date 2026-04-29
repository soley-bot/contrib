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

vi.mock('@/lib/notify', () => ({
  notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
}));

type QueryResult = { data?: unknown; error?: { message: string } | null; count?: number | null };
const queryQueue: QueryResult[] = [];
const mockFrom = vi.fn((table: string) => {
  const result = queryQueue.shift() ?? { data: null, error: null };
  const query = {
    table,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
});

vi.mock('@/lib/supabase-admin', () => ({
  adminClient: { from: (table: string) => mockFrom(table) },
}));

import handler from '@/pages/api/groups/[id]/join';

function makeReqRes(body: Record<string, unknown> = {}) {
  const req = {
    method: 'POST',
    headers: {},
    query: { id: 'group-1' },
    body,
  } as unknown as NextApiRequest;
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  const res = { status, json, end } as unknown as NextApiResponse;
  return { req, res, status, json };
}

describe('POST /api/groups/[id]/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryQueue.length = 0;
    authState.user = { id: 'user-1' };
  });

  it('requires an invite token', async () => {
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a wrong invite token', async () => {
    queryQueue.push({ data: null, error: null });
    const { req, res, status } = makeReqRes({ inviteToken: 'wrong-token' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('joins with a valid token and preserves course enrollment upsert', async () => {
    queryQueue.push(
      { data: { id: 'group-1', name: 'Group', lead_id: 'lead-1', course_id: 'course-1', archived_at: null }, error: null },
      { data: { role: 'student', name: 'Student' }, error: null },
      { data: null, error: null },
      { data: [{ id: 'group-1' }], error: null },
      { data: null, error: null },
      { count: 1, error: null },
      { error: null },
      { error: null },
      { data: { role: 'student' }, error: null },
      { error: null },
      { error: null },
    );
    const { req, res, status } = makeReqRes({ inviteToken: 'valid-token' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(mockFrom).toHaveBeenCalledWith('course_members');
  });

  it('still blocks teachers', async () => {
    queryQueue.push(
      { data: { id: 'group-1', name: 'Group', lead_id: 'lead-1', course_id: null, archived_at: null }, error: null },
      { data: { role: 'teacher', name: 'Teacher' }, error: null },
    );
    const { req, res, status } = makeReqRes({ inviteToken: 'valid-token' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(403);
  });
});
