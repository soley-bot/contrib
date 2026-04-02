import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`archive:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id as string;
  if (!groupId) return res.status(400).json({ error: 'Missing group ID.' });

  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id, archived_at')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (group.lead_id !== user.id) return res.status(403).json({ error: 'Only the group lead can archive.' });

  const { action } = req.body as { action?: string };
  const archivedAt = action === 'unarchive' ? null : new Date().toISOString();

  const { error } = await adminClient
    .from('groups')
    .update({ archived_at: archivedAt })
    .eq('id', groupId);

  if (error) {
    Sentry.captureMessage(`[groups/archive] error: ${error.message}`, { level: 'error', tags: { route: 'groups/archive' } });
    return res.status(500).json({ error: 'Failed to update group.' });
  }

  return res.status(200).json({ ok: true, archived: action !== 'unarchive' });
}
