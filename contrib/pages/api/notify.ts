import type { NextApiRequest, NextApiResponse } from 'next';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { notifyGroupMembers } from '@/lib/notify';

type NotificationType = 'contributions' | 'blockers' | 'deadlines' | 'weekly_digest';

const ALLOWED_TYPES: NotificationType[] = ['contributions', 'blockers', 'deadlines', 'weekly_digest'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { groupId, message, type } = req.body as {
    groupId?: string;
    message?: string;
    type?: string;
  };

  if (!groupId || !message || !type) {
    return res.status(400).json({ error: 'Missing groupId, message, or type.' });
  }

  if (!ALLOWED_TYPES.includes(type as NotificationType)) {
    return res.status(400).json({ error: 'Invalid notification type.' });
  }

  // Verify user is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

  await notifyGroupMembers(groupId, message, type as NotificationType, user.id);

  return res.status(200).json({ ok: true });
}
