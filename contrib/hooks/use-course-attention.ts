import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

/**
 * For each course, count how many groups "need attention":
 * - Overdue (past due_date with incomplete tasks)
 * - No activity in 3+ days
 */
async function fetchCourseAttention([, joinedIds]: [string, string]): Promise<Record<string, number>> {
  const courseIds = joinedIds.split(',').filter(Boolean);

  // Get all groups for these courses with task counts
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, course_id, due_date')
    .in('course_id', courseIds);

  if (groupsError || !groups || groups.length === 0) return {};

  const groupIds = groups.map((g) => g.id);

  const [{ data: tasks, error: tasksError }, { data: latestActivity, error: activityError }] = await Promise.all([
    supabase
      .from('tasks')
      .select('group_id, status')
      .in('group_id', groupIds)
      .is('deleted_at', null),
    supabase
      .from('activity_log')
      .select('group_id, created_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false }),
  ]);

  if (tasksError || activityError) return {};

  const tasksByGroup: Record<string, { total: number; done: number }> = {};
  groupIds.forEach((id) => { tasksByGroup[id] = { total: 0, done: 0 }; });
  (tasks ?? []).forEach((t: { group_id: string; status: string }) => {
    if (tasksByGroup[t.group_id]) {
      tasksByGroup[t.group_id].total++;
      if (t.status === 'done') tasksByGroup[t.group_id].done++;
    }
  });

  const lastActivityByGroup: Record<string, string> = {};
  (latestActivity ?? []).forEach((a: { group_id: string; created_at: string }) => {
    if (!lastActivityByGroup[a.group_id]) lastActivityByGroup[a.group_id] = a.created_at;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const counts: Record<string, number> = {};
  courseIds.forEach((id) => { counts[id] = 0; });

  for (const g of groups) {
    if (!g.course_id) continue;
    const tc = tasksByGroup[g.id] ?? { total: 0, done: 0 };
    const lastAct = lastActivityByGroup[g.id];

    let needsAttention = false;
    // Overdue
    if (g.due_date && new Date(g.due_date + 'T00:00:00') < today && tc.done < tc.total) {
      needsAttention = true;
    }
    // Stale (no activity in 3+ days)
    if (lastAct && (today.getTime() - new Date(lastAct).getTime()) >= threeDaysMs) {
      needsAttention = true;
    }
    if (!lastAct && tc.total > 0) {
      needsAttention = true;
    }

    if (needsAttention) counts[g.course_id]++;
  }

  return counts;
}

export function useCourseAttention(courseIds: string[]) {
  const { data } = useSWR(
    courseIds.length ? ['course-attention', courseIds.join(',')] : null,
    fetchCourseAttention,
  );

  return { attentionCounts: data ?? {} };
}
