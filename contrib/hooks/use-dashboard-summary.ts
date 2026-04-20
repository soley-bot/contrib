import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

interface GroupSummary {
  taskTotal: number;
  taskDone: number;
  evalOpen: boolean;
  evalSubmitted: boolean;
}

async function fetchDashboardSummary(
  groupIds: string[],
  userId: string,
): Promise<Record<string, GroupSummary>> {
  const [taskRes, evalSessionRes, evalSubmitRes] = await Promise.all([
    // Task counts per group
    supabase
      .from('tasks')
      .select('group_id, status')
      .in('group_id', groupIds)
      .is('deleted_at', null),
    // Eval sessions (open evaluations)
    supabase
      .from('evaluation_sessions')
      .select('group_id')
      .in('group_id', groupIds),
    // User's own eval submissions
    supabase
      .from('evaluations')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('evaluator_id', userId),
  ]);

  const result: Record<string, GroupSummary> = {};
  groupIds.forEach((id) => {
    result[id] = { taskTotal: 0, taskDone: 0, evalOpen: false, evalSubmitted: false };
  });

  // Count tasks
  (taskRes.data ?? []).forEach((row: { group_id: string; status: string }) => {
    if (result[row.group_id]) {
      result[row.group_id].taskTotal++;
      if (row.status === 'done') result[row.group_id].taskDone++;
    }
  });

  // Mark eval sessions
  (evalSessionRes.data ?? []).forEach((row: { group_id: string }) => {
    if (result[row.group_id]) result[row.group_id].evalOpen = true;
  });

  // Mark user submissions
  (evalSubmitRes.data ?? []).forEach((row: { group_id: string }) => {
    if (result[row.group_id]) result[row.group_id].evalSubmitted = true;
  });

  return result;
}

export function useDashboardSummary(groupIds: string[], userId: string | undefined) {
  // Sort groupIds so callers passing the same IDs in different orders share the cache.
  const sortedIds = [...groupIds].sort();
  const key =
    sortedIds.length > 0 && userId
      ? ['dashboard-summary', userId, sortedIds.join(',')]
      : null;

  const { data: summaries, isLoading: loading } = useSWR(
    key,
    ([, uid, idsStr]) => fetchDashboardSummary(idsStr.split(','), uid),
  );

  return { summaries: summaries ?? {}, loading };
}
