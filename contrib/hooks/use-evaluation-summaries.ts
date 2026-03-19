import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvaluationSummary } from '@/types';

interface UseEvaluationSummariesResult {
  summaries: EvaluationSummary[];
  loading: boolean;
  refresh: () => void;
}

export function useEvaluationSummaries(
  groupId: string | undefined,
  enabled: boolean
): UseEvaluationSummariesResult {
  const [summaries, setSummaries] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId || !enabled) return;
    setLoading(true);
    fetchSummaries(groupId).finally(() => setLoading(false));
  }, [groupId, enabled, tick]);

  async function fetchSummaries(id: string) {
    const { data } = await supabase
      .from('evaluation_summaries')
      .select('*')
      .eq('group_id', id);
    setSummaries((data as EvaluationSummary[]) ?? []);
  }

  return { summaries, loading, refresh: () => setTick((t) => t + 1) };
}
