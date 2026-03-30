import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Evidence } from '@/types';

interface UseEvidenceResult {
  evidence: Evidence[];
  error: string | null;
  refresh: () => void;
}

export function useEvidence(taskId: string | undefined): UseEvidenceResult {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!taskId) { setEvidence([]); return; }
    fetchEvidence(taskId);

    const channel = supabase
      .channel(`evidence:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evidence',
        filter: `task_id=eq.${taskId}`,
      }, () => {
        fetchEvidence(taskId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId, tick]);

  function fetchEvidence(id: string) {
    supabase
      .from('evidence')
      .select('*, uploader:profiles!evidence_uploaded_by_fkey(*)')
      .eq('task_id', id)
      .order('version_number', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error('Failed to load evidence:', fetchError);
          setError('Failed to load data.');
          return;
        }
        setError(null);
        setEvidence((data as Evidence[]) ?? []);
      });
  }

  return { evidence, error, refresh: () => setTick((t) => t + 1) };
}
