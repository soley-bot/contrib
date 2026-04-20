import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { PROFILE_SELECT } from '@/lib/columns';
import type { Evidence } from '@/types';

interface UseGroupEvidenceResult {
  evidenceByTask: Record<string, Evidence[]>;
  error: string | null;
  refresh: () => void;
}

async function fetchGroupEvidence([, joinedIds]: [string, string]): Promise<Record<string, Evidence[]>> {
  const taskIds = joinedIds.split(',').filter(Boolean);
  const { data, error } = await supabase
    .from('evidence')
    .select(`id, task_id, type, content, uploaded_by, version_number, deleted_at, created_at, file_path, file_name, file_size, mime_type, uploader:profiles!evidence_uploaded_by_fkey(${PROFILE_SELECT})`)
    .in('task_id', taskIds)
    .order('version_number', { ascending: true });
  if (error) {
    Sentry.captureMessage(`Failed to load group evidence: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  const byTask: Record<string, Evidence[]> = {};
  ((data as unknown as Evidence[]) ?? []).forEach((e) => {
    if (!byTask[e.task_id]) byTask[e.task_id] = [];
    byTask[e.task_id].push(e);
  });
  return byTask;
}

export function useGroupEvidence(taskIds: string[]): UseGroupEvidenceResult {
  const key = taskIds.join(',');
  const swrKey = taskIds.length ? ['group-evidence', key] : null;
  const { data, error, mutate } = useSWR(swrKey, fetchGroupEvidence);

  useEffect(() => {
    if (!taskIds.length) return;
    const taskIdSet = new Set(taskIds);
    const channel = supabase
      .channel(`group-evidence:${key}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evidence',
      }, (payload) => {
        const newRow = payload.new as { task_id?: string } | null;
        const oldRow = payload.old as { task_id?: string } | null;
        const rowTaskId = newRow?.task_id ?? oldRow?.task_id;
        if (rowTaskId && taskIdSet.has(rowTaskId)) {
          void mutate();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [key, mutate]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    evidenceByTask: data ?? {},
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
