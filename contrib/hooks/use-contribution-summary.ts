import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ContributionType } from '@/types';

export interface ContributionCounts {
  task: number;
  research: number;
  meeting: number;
  discussion: number;
  coordination: number;
  total: number;
}

const EMPTY: ContributionCounts = { task: 0, research: 0, meeting: 0, discussion: 0, coordination: 0, total: 0 };

export function useContributionSummary(userId: string | undefined): { counts: ContributionCounts; loading: boolean } {
  const [counts, setCounts] = useState<ContributionCounts>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('contribution_type')
        .eq('assignee_id', userId)
        .eq('status', 'done')
        .is('deleted_at', null);

      if (error || !data) { setLoading(false); return; }

      const result: ContributionCounts = { ...EMPTY };
      for (const row of data as { contribution_type: ContributionType }[]) {
        const t = row.contribution_type ?? 'task';
        if (t in result) result[t]++;
        result.total++;
      }
      setCounts(result);
      setLoading(false);
    })();
  }, [userId]);

  return { counts, loading };
}
