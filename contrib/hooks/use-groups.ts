import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types';

interface UseGroupsResult {
  groups: Group[];
  loading: boolean;
  refresh: () => void;
}

export function useGroups(userId: string | undefined): UseGroupsResult {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    fetchGroups(userId).finally(() => setLoading(false));
  }, [userId, tick]);

  async function fetchGroups(id: string) {
    const { data } = await supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('profile_id', id);
    if (data) {
      setGroups(data.map((row: { group: unknown }) => row.group as Group).filter(Boolean));
    }
  }

  return { groups, loading, refresh: () => setTick((t) => t + 1) };
}
