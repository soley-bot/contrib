import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { PROFILE_SELECT } from '@/lib/columns';
import type { Evidence } from '@/types';

interface UseEvidenceResult {
  evidence: Evidence[];
  error: string | null;
  refresh: () => void;
}

async function fetchEvidence(taskId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select(`id, task_id, uploaded_by, type, content, version_number, deleted_at, created_at, file_path, file_name, file_size, mime_type, uploader:profiles!evidence_uploaded_by_fkey(${PROFILE_SELECT})`)
    .eq('task_id', taskId)
    .order('version_number', { ascending: true });
  if (error) {
    Sentry.captureMessage(`Failed to load evidence: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data as unknown as Evidence[]) ?? [];
}

export function useEvidence(taskId: string | undefined): UseEvidenceResult {
  const key = taskId ? ['evidence', taskId] : null;
  const { data, error, mutate } = useSWR(key, ([, id]) => fetchEvidence(id));

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`evidence:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evidence',
        filter: `task_id=eq.${taskId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId, mutate]);

  return {
    evidence: data ?? [],
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
