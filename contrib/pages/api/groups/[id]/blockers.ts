import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { createBlockerSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { notifyGroupMembers } from '@/lib/notify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`blockers:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group.' });

  // Verify user is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return res.status(403).json({ error: 'You are not a member of this group.' });

  // Validate input
  const parsed = createBlockerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }

  const { reason } = parsed.data;

  // Insert blocker declaration
  const { error: blockerError } = await adminClient
    .from('blocker_declarations')
    .insert({ group_id: groupId, profile_id: user.id, reason });

  if (blockerError) {
    Sentry.captureMessage(`[blockers] insert error: ${blockerError.message}`, { level: 'error', tags: { route: 'blockers' } });
    return res.status(500).json({ error: 'Failed to save declaration.' });
  }

  // Log to activity timeline
  const { error: logError } = await adminClient
    .from('activity_log')
    .insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'blocker_declared',
      task_id: null,
      meta: { reason },
    });

  if (logError) {
    Sentry.captureMessage(`[blockers] activity log error: ${logError.message}`, { level: 'error', tags: { route: 'blockers' } });
    // Non-fatal — declaration saved, just log the error
  }

  // Notify group members via Telegram (non-fatal, fire and forget)
  const { data: actor } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  try {
    await notifyGroupMembers(
      groupId,
      `${actor?.name ?? 'A teammate'} sent a heads up: ${reason}`,
      'blockers',
      user.id,
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'blockers' } });
  }

  return res.status(201).json({ ok: true });
}
