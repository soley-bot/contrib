import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
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

async function fetchSession([, groupId]: [string, string]): Promise<EvaluationSession | null> {
  const { data, error } = await supabase
    .from('evaluation_sessions')
    .select('id, group_id, opened_by, opened_at')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) {
    Sentry.captureMessage(`Failed to load session: ${error.message}`, { level: 'error' });
    throw new Error(error.message);
  }
  return data ?? null;
}

export function useEvaluationSession(groupId: string | undefined): UseEvaluationSessionResult {
  const key = groupId ? ['eval-session', groupId] : null;
  const { data, isLoading, error, mutate } = useSWR(key, fetchSession);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`eval-sessions:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluation_sessions',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        void mutate();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, mutate]);

  async function openEvaluation(groupId: string, userId: string) {
    const { error } = await supabase.from('evaluation_sessions').insert({
      group_id: groupId,
      opened_by: userId,
    });
    if (error) throw new Error(error.message);
    void mutate();
  }

  async function resetEvaluation(groupId: string) {
    // Delete evaluations first (child rows), then the session
    const { error: evalError } = await supabase.from('evaluations').delete().eq('group_id', groupId);
    if (evalError) throw new Error(evalError.message);
    const { error: sessionError } = await supabase.from('evaluation_sessions').delete().eq('group_id', groupId);
    if (sessionError) throw new Error(sessionError.message);
    void mutate();
  }

  return {
    session: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    openEvaluation,
    resetEvaluation,
    refresh: () => void mutate(),
  };
}
