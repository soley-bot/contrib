import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityLog } from '@/types';

interface UseActivityResult {
  activity: ActivityLog[];
  loading: boolean;
  refresh: () => void;
}

export function useActivity(groupId: string | undefined): UseActivityResult {
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    setLoading(true);
    fetchActivity(groupId).finally(() => setLoading(false));
  }, [groupId, tick]);

  async function fetchActivity(id: string) {
    const { data } = await supabase
      .from('activity_log')
      .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
      .eq('group_id', id)
      .order('created_at', { ascending: false });
    setActivity((data as ActivityLog[]) ?? []);
  }

  return { activity, loading, refresh: () => setTick((t) => t + 1) };
}
