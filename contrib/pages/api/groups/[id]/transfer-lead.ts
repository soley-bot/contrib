import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { notifyGroupMembers } from '@/lib/notify';

/**
 * POST /api/groups/[id]/transfer-lead
 * Manually transfer group leadership to another member.
 * Only the current lead can do this.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`transfer-lead:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  const { newLeadId } = req.body ?? {};
  if (typeof newLeadId !== 'string' || !newLeadId) {
    return res.status(400).json({ error: 'Missing newLeadId.' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(newLeadId)) {
    return res.status(400).json({ error: 'Invalid newLeadId.' });
  }

  // Verify the group exists and caller is the current lead
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  if (group.lead_id !== user.id) {
    return res.status(403).json({ error: 'Only the current lead can transfer leadership.' });
  }

  // Verify the new lead is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', newLeadId)
    .single();

  if (!membership) {
    return res.status(400).json({ error: 'New lead must be a member of this group.' });
  }

  // Transfer leadership
  const { error: updateError } = await adminClient
    .from('groups')
    .update({ lead_id: newLeadId })
    .eq('id', groupId)
    .eq('lead_id', user.id);

  if (updateError) {
    Sentry.captureMessage(`[transfer-lead] update error: ${updateError.message}`, { level: 'error', tags: { route: 'transfer-lead' } });
    return res.status(500).json({ error: 'Failed to transfer leadership.' });
  }

  // Look up new lead's name for the notification
  const { data: newLeadProfile } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', newLeadId)
    .single();

  const newLeadName = newLeadProfile?.name ?? 'a new member';

  // Send Telegram notification and in-app notification before responding
  try {
    await Promise.all([
      notifyGroupMembers(
        groupId,
        `Group lead has been transferred to ${newLeadName}.`,
        'contributions',
        user.id
      ),
      adminClient.from('notifications').insert({
        recipient_id: newLeadId,
        group_id: groupId,
        type: 'lead_transferred',
        title: 'You are now the group lead',
        meta: { previousLeadId: user.id },
      }),
    ]);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'transfer-lead' } });
  }

  return res.status(200).json({ transferred: true });
}
