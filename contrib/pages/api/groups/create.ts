import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, createGroupApiSchema } from '@/lib/validation';
import { generateInviteToken } from '@/lib/invite';

/**
 * POST /api/groups/create
 * Server-side group creation. Replaces client-side multi-step inserts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`groups-create:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { data: input, error: validationError } = validate(createGroupApiSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  const { name, subject, dueDate, courseId, leadId } = input;

  // Determine who becomes the group lead
  let lead_id = user.id;
  let teacherIsTempLead = false;

  if (courseId) {
    // Fetch course to check ownership
    const { data: course } = await adminClient
      .from('courses')
      .select('id, teacher_id')
      .eq('id', courseId)
      .single();

    if (leadId) {
      // Teacher flow: caller must be the course teacher, and leadId must be in course_members
      if (!course) return res.status(404).json({ error: 'Course not found.' });
      if (course.teacher_id !== user.id) {
        return res.status(403).json({ error: 'Only the course teacher can assign a lead.' });
      }

      const { data: targetMembership } = await adminClient
        .from('course_members')
        .select('id')
        .eq('course_id', courseId)
        .eq('profile_id', leadId)
        .single();

      if (!targetMembership) {
        return res.status(400).json({ error: 'Target lead must be a member of this course.' });
      }

      lead_id = leadId;
    } else if (course && course.teacher_id === user.id) {
      // Teacher creating group without picking a student lead — teacher is temp lead
      lead_id = user.id;
      teacherIsTempLead = true;
    } else {
      // Student flow: caller must be in course_members
      const { data: callerMembership } = await adminClient
        .from('course_members')
        .select('id')
        .eq('course_id', courseId)
        .eq('profile_id', user.id)
        .single();

      if (!callerMembership) {
        return res.status(403).json({ error: 'You must be a member of this course.' });
      }
    }

    // One-group-per-course check (skip for teacher temp lead — they aren't a real member)
    if (!teacherIsTempLead) {
      const { data: existingMembership } = await adminClient
        .from('group_members')
        .select('group_id, groups!inner(course_id)')
        .eq('profile_id', lead_id)
        .eq('groups.course_id', courseId)
        .limit(1);

      if (existingMembership && existingMembership.length > 0) {
        return res.status(409).json({ error: 'This member is already in a group for this course.' });
      }
    }
  }

  // 1. Insert group
  const invite_token = generateInviteToken();

  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .insert({
      name,
      subject,
      due_date: dueDate || null,
      lead_id,
      created_by: user.id,
      invite_token,
      course_id: courseId || null,
    })
    .select('id, name, subject, due_date, lead_id, created_by, course_id, archived_at, created_at')
    .single();

  if (groupError || !group) {
    Sentry.captureMessage(`[groups/create] insert group error: ${groupError?.message}`, { level: 'error', tags: { route: 'groups-create' } });
    return res.status(500).json({ error: 'Failed to create group.' });
  }

  // 2. Insert group member (skip for teacher temp lead — they access via course ownership RLS)
  if (!teacherIsTempLead) {
    const { error: memberError } = await adminClient
      .from('group_members')
      .insert({ group_id: group.id, profile_id: lead_id });

    if (memberError) {
      Sentry.captureMessage(`[groups/create] insert group_members error: ${memberError.message}`, { level: 'error', tags: { route: 'groups-create' } });
      return res.status(500).json({ error: 'Failed to add lead to group.' });
    }
  }

  // 3. Insert activity log
  const { error: activityError } = await adminClient
    .from('activity_log')
    .insert({ group_id: group.id, actor_id: user.id, action: 'group_created', meta: { groupName: group.name } });

  if (activityError) {
    Sentry.captureException(activityError, { tags: { route: 'groups-create' } });
  }

  // 4. If courseId, upsert into course_members for the lead (skip for teacher temp lead)
  if (courseId && !teacherIsTempLead) {
    const { error: courseMemberError } = await adminClient
      .from('course_members')
      .upsert({ course_id: courseId, profile_id: lead_id }, { onConflict: 'course_id,profile_id' });

    if (courseMemberError) {
      Sentry.captureException(courseMemberError, { tags: { route: 'groups-create' } });
    }
  }

  return res.status(200).json({ group });
}
