import type { NextApiRequest, NextApiResponse } from 'next';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';

/**
 * POST /api/groups/[id]/auto-transfer-lead
 * When a student joins a group created by a teacher (Flow 2),
 * automatically transfer leadership from the teacher to the student.
 * Only works if the current lead is a teacher.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  // Verify the group exists and the current lead is a teacher
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const { data: leadProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', group.lead_id)
    .single();

  if (!leadProfile || leadProfile.role !== 'teacher') {
    return res.status(200).json({ transferred: false, reason: 'Lead is not a teacher.' });
  }

  // Verify the caller is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) {
    return res.status(403).json({ error: 'You must be a member of this group.' });
  }

  // Transfer leadership to the joining student
  const { error: updateError } = await adminClient
    .from('groups')
    .update({ lead_id: user.id })
    .eq('id', groupId);

  if (updateError) return res.status(500).json({ error: 'Failed to transfer leadership.' });

  // Remove the teacher from group_members
  await adminClient
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', group.lead_id);

  return res.status(200).json({ transferred: true });
}
