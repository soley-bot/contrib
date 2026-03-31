import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface GroupSummary {
  taskTotal: number;
  taskDone: number;
  evalOpen: boolean;
  evalSubmitted: boolean;
}

export function useDashboardSummary(groupIds: string[], userId: string | undefined) {
  const [summaries, setSummaries] = useState<Record<string, GroupSummary>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (groupIds.length === 0 || !userId) return;
    setLoading(true);

    async function fetch() {
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
          .eq('evaluator_id', userId!),
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

      setSummaries(result);
      setLoading(false);
    }

    fetch();
  }, [groupIds.join(','), userId]);

  return { summaries, loading };
}
