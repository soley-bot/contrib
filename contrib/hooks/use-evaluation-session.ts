import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvaluationSession } from '@/types';

interface UseEvaluationSessionResult {
  session: EvaluationSession | null;
  loading: boolean;
  openEvaluation: (groupId: string, userId: string) => Promise<void>;
  closeEvaluation: (groupId: string) => Promise<void>;
  refresh: () => void;
}

export function useEvaluationSession(groupId: string | undefined): UseEvaluationSessionResult {
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    fetchSession(groupId).finally(() => setLoading(false));
  }, [groupId, tick]);

  async function fetchSession(id: string) {
    const { data } = await supabase
      .from('evaluation_sessions')
      .select('*')
      .eq('group_id', id)
      .maybeSingle();
    setSession(data ?? null);
  }

  async function openEvaluation(groupId: string, userId: string) {
    await supabase.from('evaluation_sessions').insert({
      group_id: groupId,
      opened_by: userId,
    });
    setTick((t) => t + 1);
  }

  async function closeEvaluation(groupId: string) {
    await supabase.from('evaluations').delete().eq('group_id', groupId);
    await supabase.from('evaluation_sessions').delete().eq('group_id', groupId);
    setTick((t) => t + 1);
  }

  return { session, loading, openEvaluation, closeEvaluation, refresh: () => setTick((t) => t + 1) };
}
