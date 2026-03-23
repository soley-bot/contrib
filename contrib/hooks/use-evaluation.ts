import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Evaluation } from '@/types';

type EvaluationInsert = Omit<Evaluation, 'id' | 'submitted_at'>;

interface UseEvaluationResult {
  hasSubmitted: boolean;
  loading: boolean;
  submit: (entries: EvaluationInsert[]) => Promise<void>;
  refresh: () => void;
}

export function useEvaluation(
  groupId: string | undefined,
  userId: string | undefined
): UseEvaluationResult {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId || !userId) return;
    setLoading(true);
    checkSubmitted(groupId, userId).finally(() => setLoading(false));
  }, [groupId, userId, tick]);

  async function checkSubmitted(gid: string, uid: string) {
    const { data } = await supabase
      .from('evaluations')
      .select('id')
      .eq('group_id', gid)
      .eq('evaluator_id', uid)
      .limit(1);
    setHasSubmitted((data?.length ?? 0) > 0);
  }

  const [submitting, setSubmitting] = useState(false);

  async function submit(entries: EvaluationInsert[]) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('evaluations').insert(entries);
      if (error) throw error;
      setTick((t) => t + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return { hasSubmitted, loading, submit, refresh: () => setTick((t) => t + 1) };
}
