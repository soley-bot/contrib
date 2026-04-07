import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/courses/[id]/leave
 * Student unenrolls from a course. Blocked if they still belong to an active
 * (non-archived) group in that course — they must archive/leave the group first.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`courses-leave:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const courseId = req.query.id;
  if (typeof courseId !== 'string' || !courseId) {
    return res.status(400).json({ error: 'Invalid course id.' });
  }

  const { data: course, error: courseError } = await adminClient
    .from('courses')
    .select('id, teacher_id')
    .eq('id', courseId)
    .single();

  if (courseError || !course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  // Teachers can't "leave" a course they own — they must delete it instead.
  if (course.teacher_id === user.id) {
    return res.status(400).json({ error: 'Teachers cannot leave their own course. Delete the course instead.' });
  }

  // Caller must actually be enrolled.
  const { data: membership } = await adminClient
    .from('course_members')
    .select('id')
    .eq('course_id', courseId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) {
    return res.status(404).json({ error: 'You are not enrolled in this course.' });
  }

  // Block leaving while still in an active group for this course — the
  // student should leave or archive the group first so teammates aren't left
  // with a phantom member.
  const { data: activeMembership } = await adminClient
    .from('group_members')
    .select('group_id, groups!inner(course_id, archived_at)')
    .eq('profile_id', user.id)
    .eq('groups.course_id', courseId)
    .is('groups.archived_at', null)
    .limit(1);

  if (activeMembership && activeMembership.length > 0) {
    return res.status(409).json({
      error: 'You are still in an active group for this course. Leave the group first.',
    });
  }

  const { error: deleteError } = await adminClient
    .from('course_members')
    .delete()
    .eq('course_id', courseId)
    .eq('profile_id', user.id);

  if (deleteError) {
    Sentry.captureMessage(`[courses/leave] delete error: ${deleteError.message}`, {
      level: 'error',
      tags: { route: 'courses-leave' },
    });
    return res.status(500).json({ error: 'Failed to leave course.' });
  }

  return res.status(200).json({ ok: true });
}
