import { useState, useEffect } from 'react';
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
      .select('*, uploader:profiles!evidence_uploaded_by_fkey(*)')
      .in('task_id', taskIds)
      .order('version_number', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error('Failed to load group evidence:', fetchError);
          setError('Failed to load data.');
          return;
        }
        setError(null);
        const byTask: Record<string, Evidence[]> = {};
        ((data as Evidence[]) ?? []).forEach((e) => {
          if (!byTask[e.task_id]) byTask[e.task_id] = [];
          byTask[e.task_id].push(e);
        });
        setEvidenceByTask(byTask);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { evidenceByTask, error, refresh: () => setTick((t) => t + 1) };
}
