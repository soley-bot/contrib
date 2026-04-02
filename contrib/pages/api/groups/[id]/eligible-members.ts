import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * GET /api/groups/[id]/eligible-members
 * Returns enrolled course students who can be added to this group
 * (i.e. course members not already in any group in this course).
 * Auth: course teacher OR group lead.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`eligible-members:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  // Fetch the group
  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .select('id, lead_id, course_id')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  if (!group.course_id) {
    return res.status(400).json({ error: 'Standalone groups do not have eligible members. Use the invite link instead.' });
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
    return res.status(403).json({ error: 'Only the course teacher or group lead can view eligible members.' });
  }

  // Get all course members
  const { data: courseMembers, error: courseMembersError } = await adminClient
    .from('course_members')
    .select('profile_id')
    .eq('course_id', group.course_id);

  if (courseMembersError) {
    Sentry.captureMessage(`[eligible-members] course members error: ${courseMembersError.message}`, { level: 'error', tags: { route: 'eligible-members' } });
    return res.status(500).json({ error: 'Failed to fetch course members.' });
  }

  if (!courseMembers || courseMembers.length === 0) {
    return res.status(200).json({ members: [] });
  }

  // Get all group members across ALL groups in this course
  const { data: courseGroups } = await adminClient
    .from('groups')
    .select('id')
    .eq('course_id', group.course_id);

  const courseGroupIds = (courseGroups ?? []).map(g => g.id);

  const { data: allGroupMembers } = await adminClient
    .from('group_members')
    .select('profile_id')
    .in('group_id', courseGroupIds);

  const groupedIds = new Set((allGroupMembers ?? []).map(m => m.profile_id));

  // Filter: course members NOT in any group in this course
  const eligibleIds = courseMembers
    .map(m => m.profile_id)
    .filter(id => !groupedIds.has(id));

  if (eligibleIds.length === 0) {
    return res.status(200).json({ members: [] });
  }

  // Fetch their profiles
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, name, university, faculty, year_of_study, avatar_url, role, created_at')
    .in('id', eligibleIds);

  if (profilesError) {
    Sentry.captureMessage(`[eligible-members] profiles error: ${profilesError.message}`, { level: 'error', tags: { route: 'eligible-members' } });
    return res.status(500).json({ error: 'Failed to fetch profiles.' });
  }

  return res.status(200).json({ members: profiles ?? [] });
}
