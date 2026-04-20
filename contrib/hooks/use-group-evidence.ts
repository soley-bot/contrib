import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Evidence } from '@/types';

interface UseGroupEvidenceResult {
  evidenceByTask: Record<string, Evidence[]>;
  error: string | null;
  refresh: () => void;
}

export function useGroupEvidence(taskIds: string[]): UseGroupEvidenceResult {
  const [evidenceByTask, setEvidenceByTask] = useState<Record<string, Evidence[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const key = taskIds.join(',');

  useEffect(() => {
    mountedRef.current = true;
    if (!taskIds.length) { setEvidenceByTask({}); return; }
    const taskIdSet = new Set(taskIds);

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('evidence')
        .select('id, task_id, type, content, uploaded_by, version_number, deleted_at, created_at, file_path, file_name, file_size, mime_type, uploader:profiles!evidence_uploaded_by_fkey(id, name, avatar_url)')
        .in('task_id', Array.from(taskIdSet))
        .order('version_number', { ascending: true });
      if (!mountedRef.current) return;
      if (fetchError) {
        Sentry.captureMessage(`Failed to load group evidence: ${fetchError.message}`, { level: 'error' });
        setError('Failed to load data.');
        return;
      }
      setError(null);
      const byTask: Record<string, Evidence[]> = {};
      ((data as unknown as Evidence[]) ?? []).forEach((e) => {
        if (!byTask[e.task_id]) byTask[e.task_id] = [];
        byTask[e.task_id].push(e);
      });
      setEvidenceByTask(byTask);
    }
    load();

    // Realtime: subscribe to all evidence changes, filter client-side by taskIds.
    // Supabase realtime enforces RLS on postgres_changes, so the client only
    // receives events for evidence rows its user is allowed to see.
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
          load();
        }
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [key, tick]);

  return { evidenceByTask, error, refresh: () => setTick((t) => t + 1) };
}
