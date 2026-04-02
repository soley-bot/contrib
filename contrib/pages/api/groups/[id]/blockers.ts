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

  // Fetch actor name, group name, and group members in parallel for notifications
  const [{ data: actor }, { data: groupData }, { data: members }] = await Promise.all([
    adminClient.from('profiles').select('name').eq('id', user.id).single(),
    adminClient.from('groups').select('name').eq('id', groupId).single(),
    adminClient.from('group_members').select('profile_id').eq('group_id', groupId),
  ]);

  const actorName = actor?.name ?? 'A teammate';
  const message = `${actorName} sent a heads up: ${reason}`;

  // Send Telegram + in-app notifications (non-fatal)
  try {
    const recipientIds = (members ?? [])
      .map((m: { profile_id: string }) => m.profile_id)
      .filter((id) => id !== user.id);

    const notificationInserts = recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      group_id: groupId,
      type: 'blocker_declared' as const,
      title: message,
      meta: { reason, actorName, groupName: groupData?.name ?? null },
    }));

    await Promise.all([
      notifyGroupMembers(groupId, message, 'blockers', user.id),
      notificationInserts.length > 0
        ? adminClient.from('notifications').insert(notificationInserts)
        : Promise.resolve(),
    ]);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'blockers' } });
  }

  return res.status(201).json({ ok: true });
}
