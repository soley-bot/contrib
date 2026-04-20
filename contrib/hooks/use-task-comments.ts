import { useEffect } from 'react';
import useSWR from 'swr';
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

async function fetchTaskComments([, taskId]: [string, string]): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select(`id, task_id, author_id, content, deleted_at, created_at, author:profiles!task_comments_author_id_fkey(${PROFILE_SELECT})`)
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    Sentry.captureMessage(`Failed to load comments: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load comments.');
  }
  return (data as unknown as TaskComment[]) ?? [];
}

export function useTaskComments(taskId: string | undefined): UseTaskCommentsResult {
  const key = taskId ? ['task-comments', taskId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchTaskComments);

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId, mutate]);

  return {
    comments: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
