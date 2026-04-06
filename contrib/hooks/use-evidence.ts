import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { PROFILE_SELECT } from '@/lib/columns';
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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
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

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [taskId, tick]);

  async function fetchEvidence(id: string) {
    const { data, error: fetchError } = await supabase
      .from('evidence')
      .select(`id, task_id, uploaded_by, type, content, version_number, deleted_at, created_at, uploader:profiles!evidence_uploaded_by_fkey(${PROFILE_SELECT})`)
      .eq('task_id', id)
      .order('version_number', { ascending: true });
    if (fetchError) {
      Sentry.captureMessage(`Failed to load evidence: ${fetchError.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load data.');
      return;
    }
    if (!mountedRef.current) return;
    setError(null);
    setEvidence((data as unknown as Evidence[]) ?? []);
  }

  return { evidence, error, refresh: () => setTick((t) => t + 1) };
}
