import { useState, useEffect } from 'react';
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

  const key = taskIds.join(',');

  useEffect(() => {
    if (!taskIds.length) { setEvidenceByTask({}); return; }
    supabase
      .from('evidence')
      .select('id, task_id, type, content, note, uploaded_by, version_number, deleted_at, created_at, uploader:profiles!evidence_uploaded_by_fkey(id, name, avatar_url)')
      .in('task_id', taskIds)
      .order('version_number', { ascending: true })
      .then(({ data, error: fetchError }) => {
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
      });
  }, [key, tick]);

  return { evidenceByTask, error, refresh: () => setTick((t) => t + 1) };
}
