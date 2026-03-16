import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Evidence } from '@/types';

interface UseEvidenceResult {
  evidence: Evidence[];
  refresh: () => void;
}

export function useEvidence(taskId: string | undefined): UseEvidenceResult {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!taskId) { setEvidence([]); return; }
    supabase
      .from('evidence')
      .select('*, uploader:profiles!evidence_uploaded_by_fkey(*)')
      .eq('task_id', taskId)
      .order('version_number', { ascending: true })
      .then(({ data }) => setEvidence((data as Evidence[]) ?? []));
  }, [taskId, tick]);

  return { evidence, refresh: () => setTick((t) => t + 1) };
}
