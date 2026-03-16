import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  refresh: () => void;
}

export function useTasks(groupId: string | undefined): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    fetchTasks(groupId).finally(() => setLoading(false));
  }, [groupId, tick]);

  async function fetchTasks(id: string) {
    const { data } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(*)')
      .eq('group_id', id)
      .order('created_at', { ascending: false });
    setTasks((data as Task[]) ?? []);
  }

  return { tasks, loading, refresh: () => setTick((t) => t + 1) };
}
