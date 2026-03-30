import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvaluationSummary } from '@/types';

interface UseEvaluationSummariesResult {
  summaries: EvaluationSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEvaluationSummaries(
  groupId: string | undefined,
  enabled: boolean
): UseEvaluationSummariesResult {
  const [summaries, setSummaries] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId || !enabled) return;
    setLoading(true);
    fetchSummaries(groupId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`evaluations:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluations',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchSummaries(groupId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, enabled, tick]);

  async function fetchSummaries(id: string) {
    const { data, error } = await supabase
      .from('evaluation_summaries')
      .select('*')
      .eq('group_id', id);
    if (error) {
      console.error('Failed to load evaluation summaries:', error);
      setError('Failed to load data.');
      return;
    }
    setError(null);
    setSummaries((data as EvaluationSummary[]) ?? []);
  }

  return { summaries, loading, error, refresh: () => setTick((t) => t + 1) };
}
