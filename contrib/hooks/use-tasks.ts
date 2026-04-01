import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTasks(groupId: string | undefined): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!groupId) { setLoading(false); return; }
    setLoading(true);
    fetchTasks(groupId).finally(() => { if (mountedRef.current) setLoading(false); });

    const channel = supabase
      .channel(`tasks:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchTasks(groupId);
      })
      .subscribe();

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [groupId, tick]);

  async function fetchTasks(id: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(*)')
      .eq('group_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      Sentry.captureMessage(`Failed to load tasks: ${error.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load data.');
      return;
    }
    if (!mountedRef.current) return;
    setError(null);
    setTasks((data as Task[]) ?? []);
  }

  return { tasks, loading, error, refresh: () => setTick((t) => t + 1) };
}
