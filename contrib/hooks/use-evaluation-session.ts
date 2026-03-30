import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvaluationSession } from '@/types';

interface UseEvaluationSessionResult {
  session: EvaluationSession | null;
  loading: boolean;
  error: string | null;
  openEvaluation: (groupId: string, userId: string) => Promise<void>;
  resetEvaluation: (groupId: string) => Promise<void>;
  refresh: () => void;
}

export function useEvaluationSession(groupId: string | undefined): UseEvaluationSessionResult {
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    fetchSession(groupId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`eval-sessions:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluation_sessions',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchSession(groupId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, tick]);

  async function fetchSession(id: string) {
    const { data, error } = await supabase
      .from('evaluation_sessions')
      .select('*')
      .eq('group_id', id)
      .maybeSingle();
    if (error) { console.error('Failed to load session:', error); setError('Failed to load data.'); return; }
    setError(null);
    setSession(data ?? null);
  }

  async function openEvaluation(groupId: string, userId: string) {
    const { error } = await supabase.from('evaluation_sessions').insert({
      group_id: groupId,
      opened_by: userId,
    });
    if (error) throw new Error(error.message);
    setTick((t) => t + 1);
  }

  async function resetEvaluation(groupId: string) {
    // Delete evaluations first (child rows), then the session
    const { error: evalError } = await supabase.from('evaluations').delete().eq('group_id', groupId);
    if (evalError) throw new Error(evalError.message);
    const { error: sessionError } = await supabase.from('evaluation_sessions').delete().eq('group_id', groupId);
    if (sessionError) throw new Error(sessionError.message);
    setTick((t) => t + 1);
  }

  return { session, loading, error, openEvaluation, resetEvaluation, refresh: () => setTick((t) => t + 1) };
}
