import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, removeMemberSchema } from '@/lib/validation';

/**
 * POST /api/groups/[id]/remove-member
 * Teacher removes a student from a group.
 * Auth: course teacher ONLY.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`remove-member:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  // Validate body
  const { data: body, error: validationError } = validate(removeMemberSchema, req.body);
  if (validationError || !body) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  const { profileId } = body;

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  // Fetch the group
  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .select('id, lead_id, course_id, name')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  if (!group.course_id) {
    return res.status(400).json({ error: 'Cannot remove members from a standalone group.' });
  }

  // Authorization: caller must be the course teacher
  const { data: course } = await adminClient
    .from('courses')
    .select('teacher_id')
    .eq('id', group.course_id)
    .single();

  if (!course || course.teacher_id !== user.id) {
    return res.status(403).json({ error: 'Only the course teacher can remove members.' });
  }

  // Verify target is a group member
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .single();

  if (!membership) {
    return res.status(404).json({ error: 'Student is not a member of this group.' });
  }

  // Target must NOT be the lead
  if (profileId === group.lead_id) {
    return res.status(400).json({ error: 'Cannot remove the group lead. Transfer leadership first.' });
  }

  // Reassign target's tasks to the lead
  const { error: reassignError } = await adminClient
    .from('tasks')
    .update({ assignee_id: group.lead_id })
    .eq('group_id', groupId)
    .eq('assignee_id', profileId)
    .is('deleted_at', null);

  if (reassignError) {
    Sentry.captureMessage(`[remove-member] task reassign error: ${reassignError.message}`, { level: 'error', tags: { route: 'remove-member' } });
    return res.status(500).json({ error: 'Failed to reassign tasks.' });
  }

  // DELETE from group_members
  const { error: deleteError } = await adminClient
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', profileId);

  if (deleteError) {
    Sentry.captureMessage(`[remove-member] delete error: ${deleteError.message}`, { level: 'error', tags: { route: 'remove-member' } });
    return res.status(500).json({ error: 'Failed to remove member.' });
  }

  // Fetch removed student's name for activity log
  const { data: profile } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', profileId)
    .single();

  const removedName = profile?.name ?? 'Unknown';

  // Log to activity timeline
  const { error: logError } = await adminClient
    .from('activity_log')
    .insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'member_removed',
      meta: { removed_name: removedName },
    });

  if (logError) {
    Sentry.captureMessage(`[remove-member] activity log error: ${logError.message}`, { level: 'error', tags: { route: 'remove-member' } });
    // Non-fatal
  }

  // Notify removed student
  const { error: notifyError } = await adminClient
    .from('notifications')
    .insert({
      recipient_id: profileId,
      group_id: groupId,
      type: 'member_joined',
      title: 'You were removed from ' + group.name,
      meta: { groupName: group.name ?? null },
    });

  if (notifyError) {
    Sentry.captureMessage(`[remove-member] notification error: ${notifyError.message}`, { level: 'error', tags: { route: 'remove-member' } });
    // Non-fatal
  }

  return res.status(200).json({ success: true });
}
