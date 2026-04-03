import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`course-delete:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const courseId = req.query.id;
  if (typeof courseId !== 'string') return res.status(400).json({ error: 'Invalid course.' });

  // Verify user owns this course
  const { data: course } = await adminClient
    .from('courses')
    .select('id, teacher_id')
    .eq('id', courseId)
    .single();

  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (course.teacher_id !== user.id) return res.status(403).json({ error: 'Not authorized.' });

  // Fetch all groups in this course
  const { data: groups } = await adminClient
    .from('groups')
    .select('id')
    .eq('course_id', courseId);

  const groupIds = (groups ?? []).map((g: { id: string }) => g.id);

  if (groupIds.length > 0) {
    // Fetch all task IDs for these groups (for cleaning up evidence + task_comments)
    const { data: taskRows } = await adminClient
      .from('tasks')
      .select('id')
      .in('group_id', groupIds);

    const taskIds = (taskRows ?? []).map((t: { id: string }) => t.id);

    // Soft-delete all tasks
    await adminClient
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .in('group_id', groupIds);

    if (taskIds.length > 0) {
      // Soft-delete task_comments for these tasks
      const { error: commentsErr } = await adminClient
        .from('task_comments')
        .update({ deleted_at: new Date().toISOString() })
        .in('task_id', taskIds);
      if (commentsErr) {
        Sentry.captureMessage(`[course-delete] task_comments error: ${commentsErr.message}`, { level: 'error', tags: { route: 'course-delete' } });
      }

      // Soft-delete evidence for these tasks
      const { error: evidenceErr } = await adminClient
        .from('evidence')
        .update({ deleted_at: new Date().toISOString() })
        .in('task_id', taskIds);
      if (evidenceErr) {
        Sentry.captureMessage(`[course-delete] evidence error: ${evidenceErr.message}`, { level: 'error', tags: { route: 'course-delete' } });
      }
    }

    // Delete group_members, activity_log, notifications, blocker_declarations, evaluations, eval sessions, report_shares for these groups
    const deleteOps = [
      adminClient.from('group_members').delete().in('group_id', groupIds),
      adminClient.from('activity_log').delete().in('group_id', groupIds),
      adminClient.from('notifications').delete().in('group_id', groupIds),
      adminClient.from('blocker_declarations').delete().in('group_id', groupIds),
      adminClient.from('evaluations').delete().in('group_id', groupIds),
      adminClient.from('evaluation_sessions').delete().in('group_id', groupIds),
      adminClient.from('report_shares').delete().in('group_id', groupIds),
    ];

    const results = await Promise.all(deleteOps);
    results.forEach((result, i) => {
      if (result.error) {
        const tables = ['group_members', 'activity_log', 'notifications', 'blocker_declarations', 'evaluations', 'evaluation_sessions', 'report_shares'];
        Sentry.captureMessage(`[course-delete] ${tables[i]} error: ${result.error.message}`, { level: 'error', tags: { route: 'course-delete' } });
      }
    });

    // Archive the groups
    const { error: groupsErr } = await adminClient
      .from('groups')
      .update({ archived_at: new Date().toISOString() })
      .in('id', groupIds);
    if (groupsErr) {
      Sentry.captureMessage(`[course-delete] groups error: ${groupsErr.message}`, { level: 'error', tags: { route: 'course-delete' } });
      return res.status(500).json({ error: 'Failed to delete course groups.' });
    }
  }

  // Delete course_members
  const { error: cmErr } = await adminClient
    .from('course_members')
    .delete()
    .eq('course_id', courseId);
  if (cmErr) {
    Sentry.captureMessage(`[course-delete] course_members error: ${cmErr.message}`, { level: 'error', tags: { route: 'course-delete' } });
  }

  // Delete the course
  const { error: courseErr } = await adminClient
    .from('courses')
    .delete()
    .eq('id', courseId);
  if (courseErr) {
    Sentry.captureMessage(`[course-delete] course error: ${courseErr.message}`, { level: 'error', tags: { route: 'course-delete' } });
    return res.status(500).json({ error: 'Failed to delete course.' });
  }

  return res.status(200).json({ ok: true });
}
