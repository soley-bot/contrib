import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { PROFILE_SELECT } from '@/lib/columns';
import type { Task } from '@/types';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchTasks(groupId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`id, group_id, title, description, assignee_id, status, due_date, evidence_url, completed_at, contribution_type, deleted_at, created_at, assignee:profiles!tasks_assignee_id_fkey(${PROFILE_SELECT})`)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    Sentry.captureMessage(`Failed to load tasks: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data as unknown as Task[]) ?? [];
}

export function useTasks(groupId: string | undefined): UseTasksResult {
  const key = groupId ? ['tasks', groupId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchTasks(id));

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`tasks:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `group_id=eq.${groupId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, mutate]);

  return {
    tasks: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
