import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { EvaluationSummary } from '@/types';

interface UseEvaluationSummariesResult {
  summaries: EvaluationSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchSummaries([, groupId]: [string, string]): Promise<EvaluationSummary[]> {
  const { data, error } = await supabase
    .from('evaluation_summaries')
    .select('group_id, evaluatee_id, avg_contribution, avg_collaboration, eval_count, comments')
    .eq('group_id', groupId);
  if (error) {
    Sentry.captureMessage(`Failed to load evaluation summaries: ${error.message}`, { level: 'error' });
    throw new Error(error.message);
  }
  return (data as EvaluationSummary[]) ?? [];
}

export function useEvaluationSummaries(
  groupId: string | undefined,
  enabled: boolean
): UseEvaluationSummariesResult {
  const key = groupId && enabled ? ['eval-summaries', groupId] : null;
  const { data, isLoading, error, mutate } = useSWR(key, fetchSummaries);

  useEffect(() => {
    if (!groupId || !enabled) return;

    const channel = supabase
      .channel(`evaluations:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluations',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        void mutate();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, enabled, mutate]);

  return {
    summaries: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => void mutate(),
  };
}
