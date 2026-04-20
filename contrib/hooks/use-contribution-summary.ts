import useSWR from 'swr';
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

export const EMPTY: ContributionCounts = { task: 0, research: 0, meeting: 0, discussion: 0, coordination: 0, total: 0 };

async function fetchContributionSummary(userId: string): Promise<ContributionCounts> {
  const { data, error } = await supabase
    .from('tasks')
    .select('contribution_type')
    .eq('assignee_id', userId)
    .eq('status', 'done')
    .is('deleted_at', null);

  if (error || !data) { return { ...EMPTY }; }

  const result: ContributionCounts = { ...EMPTY };
  for (const row of data as { contribution_type: ContributionType }[]) {
    const t = row.contribution_type ?? 'task';
    if (t in result) result[t as keyof Omit<ContributionCounts, 'total'>]++;
    result.total++;
  }
  return result;
}

export function useContributionSummary(userId: string | undefined): { counts: ContributionCounts; loading: boolean } {
  const { data, isLoading } = useSWR(
    userId ? ['contribution-summary', userId] : null,
    ([, uid]: [string, string]) => fetchContributionSummary(uid),
  );

  return { counts: data ?? EMPTY, loading: isLoading };
}
