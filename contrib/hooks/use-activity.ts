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

    // NOTE: Supabase realtime requires the 'activity_log' table to have realtime enabled in the Supabase dashboard.
    const channel = supabase
      .channel(`activity:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_log',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchActivity(groupId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
