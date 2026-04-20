import { useState } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { EvaluationInsert } from '@/types';

interface UseEvaluationResult {
  hasSubmitted: boolean;
  loading: boolean;
  submit: (entries: EvaluationInsert[]) => Promise<void>;
  refresh: () => void;
}

async function checkSubmitted([, groupId, userId]: [string, string, string]): Promise<boolean> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('id')
    .eq('group_id', groupId)
    .eq('evaluator_id', userId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export function useEvaluation(
  groupId: string | undefined,
  userId: string | undefined
): UseEvaluationResult {
  const key = groupId && userId ? ['eval-submitted', groupId, userId] : null;
  const { data, isLoading, mutate } = useSWR(key, checkSubmitted);

  const [submitting, setSubmitting] = useState(false);

  async function submit(entries: EvaluationInsert[]) {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Filter out any self-reviews (evaluator === evaluatee) as a client-side guard
      const filtered = entries.filter((e) => e.evaluator_id !== e.evaluatee_id);
      if (filtered.length === 0) return;
      const { error } = await supabase.from('evaluations').insert(filtered);
      if (error) throw error;
      void mutate();
    } finally {
      setSubmitting(false);
    }
  }

  return { hasSubmitted: data ?? false, loading: isLoading, submit, refresh: () => void mutate() };
}
