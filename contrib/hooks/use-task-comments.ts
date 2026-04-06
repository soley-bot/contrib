import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { PROFILE_SELECT } from '@/lib/columns';
import type { TaskComment } from '@/types';

interface UseTaskCommentsResult {
  comments: TaskComment[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTaskComments(taskId: string | undefined): UseTaskCommentsResult {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!taskId) { setComments([]); setLoading(false); return; }
    setLoading(true);
    fetchComments(taskId).finally(() => { if (mountedRef.current) setLoading(false); });

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
      }, () => {
        fetchComments(taskId);
      })
      .subscribe();

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [taskId, tick]);

  async function fetchComments(id: string) {
    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select(`id, task_id, author_id, content, deleted_at, created_at, author:profiles!task_comments_author_id_fkey(${PROFILE_SELECT})`)
      .eq('task_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (fetchError) {
      Sentry.captureMessage(`Failed to load comments: ${fetchError.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load comments.');
      return;
    }
    if (!mountedRef.current) return;
    setError(null);
    setComments((data as unknown as TaskComment[]) ?? []);
  }

  return { comments, loading, error, refresh: () => setTick((t) => t + 1) };
}
