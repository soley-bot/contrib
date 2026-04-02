import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { notifyGroupMembers } from '@/lib/notify';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const notifyBodySchema = z.object({
  groupId: z.string().uuid('Invalid group ID.'),
  message: z.string().trim().min(1, 'Message is required.').max(500, 'Message must be 500 characters or less.'),
  type: z.enum(['contributions', 'blockers', 'deadlines'], { message: 'Invalid notification type.' }),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`notify:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const parsed = notifyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { groupId, message, type } = parsed.data;

  // Verify user is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

  await notifyGroupMembers(groupId, message, type, user.id);

  return res.status(200).json({ ok: true });
}
