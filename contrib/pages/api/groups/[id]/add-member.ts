import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, addMemberSchema } from '@/lib/validation';
import { GROUP_MAX_MEMBERS } from '@/lib/group-constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`add-member:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  // Validate body
  const { data: body, error: validationError } = validate(addMemberSchema, req.body);
  if (validationError || !body) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  const { profileId } = body;

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group.' });

  // Fetch the group
  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .select('id, lead_id, course_id, name, archived_at')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    return res.status(400).json({ error: 'Group not found.' });
  }

  // Cannot add members to an archived group
  if (group.archived_at) {
    return res.status(410).json({ error: 'This group has been archived.' });
  }

  if (!group.course_id) {
    return res.status(400).json({ error: 'Cannot add members to a standalone group. Use the invite link instead.' });
  }

  // Authorization: caller must be course teacher OR group lead
  const { data: course } = await adminClient
    .from('courses')
    .select('teacher_id')
    .eq('id', group.course_id)
    .single();

  const isCourseTeacher = course?.teacher_id === user.id;
  const isGroupLead = group.lead_id === user.id;

  if (!isCourseTeacher && !isGroupLead) {
    return res.status(403).json({ error: 'Only the course teacher or group lead can add members.' });
  }

  // Target must be enrolled in the course
  const { data: courseMembership } = await adminClient
    .from('course_members')
    .select('id')
    .eq('course_id', group.course_id)
    .eq('profile_id', profileId)
    .single();

  if (!courseMembership) {
    return res.status(400).json({ error: 'Student is not enrolled in this course.' });
  }

  // Target must NOT already be in this group
  const { data: existingMember } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingMember) {
    return res.status(409).json({ error: 'Student is already in this group.' });
  }

  // Target must NOT be in any other ACTIVE group in the same course (one-group-per-course rule).
  // Archived groups do NOT count — a student whose previous group in this course was archived
  // is free to be added to a new one. The membership row is kept for history.
  const { data: otherGroups } = await adminClient
    .from('group_members')
    .select('group_id, groups!inner(course_id, archived_at)')
    .eq('profile_id', profileId);

  const alreadyInCourseGroup = (otherGroups ?? []).some(
    (row: unknown) => {
      const r = row as {
        group_id: string;
        groups:
          | { course_id: string | null; archived_at: string | null }
          | { course_id: string | null; archived_at: string | null }[];
      };
      const g = Array.isArray(r.groups) ? r.groups[0] : r.groups;
      return g?.course_id === group.course_id && g?.archived_at === null;
    }
  );

  if (alreadyInCourseGroup) {
    return res.status(409).json({ error: 'Student is already in another active group in this course.' });
  }

  // Group must not be full.
  const { count, error: countError } = await adminClient
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (countError) {
    Sentry.captureMessage(`[add-member] count error: ${countError.message}`, { level: 'error', tags: { route: 'add-member' } });
    return res.status(500).json({ error: 'Failed to check group capacity.' });
  }

  if ((count ?? 0) >= GROUP_MAX_MEMBERS) {
    return res.status(400).json({ error: `Group is full. Groups can have up to ${GROUP_MAX_MEMBERS} members.` });
  }

  // INSERT into group_members
  const { error: insertError } = await adminClient
    .from('group_members')
    .insert({ group_id: groupId, profile_id: profileId });

  if (insertError) {
    Sentry.captureMessage(`[add-member] insert error: ${insertError.message}`, { level: 'error', tags: { route: 'add-member' } });
    return res.status(500).json({ error: 'Failed to add member.' });
  }

  // Fetch the added student's name for activity log and notification
  const { data: profile } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', profileId)
    .single();

  const addedName = profile?.name ?? 'Unknown';

  // Log to activity timeline
  const { error: logError } = await adminClient
    .from('activity_log')
    .insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'member_added',
      meta: { added_name: addedName },
    });

  if (logError) {
    Sentry.captureMessage(`[add-member] activity log error: ${logError.message}`, { level: 'error', tags: { route: 'add-member' } });
    // Non-fatal — member was added, just log the error
  }

  // Auto-transfer lead from teacher to first student added
  const { data: leadProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', group.lead_id)
    .single();

  if (leadProfile?.role === 'teacher') {
    await adminClient
      .from('groups')
      .update({ lead_id: profileId })
      .eq('id', groupId);

    await adminClient.from('activity_log').insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'lead_transferred',
      meta: { newLeadName: addedName },
    });

    await adminClient.from('notifications').insert({
      recipient_id: profileId,
      group_id: groupId,
      type: 'lead_transferred',
      title: 'You are now the group lead',
      meta: { groupName: group.name ?? null },
    });
  }

  // Send notification to the added student
  const { error: notifyError } = await adminClient
    .from('notifications')
    .insert({
      recipient_id: profileId,
      group_id: groupId,
      type: 'member_joined',
      title: 'You were added to a group',
      meta: { groupName: group.name ?? null },
    });

  if (notifyError) {
    Sentry.captureMessage(`[add-member] notification error: ${notifyError.message}`, { level: 'error', tags: { route: 'add-member' } });
    // Non-fatal
  }

  return res.status(201).json({ success: true });
}
