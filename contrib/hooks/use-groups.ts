import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types';

interface UseGroupsResult {
  groups: Group[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGroups(userId: string | undefined): UseGroupsResult {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    fetchGroups(userId).finally(() => setLoading(false));
  }, [userId, tick]);

  async function fetchGroups(id: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('profile_id', id);
    if (error) {
      console.error('Failed to load groups:', error);
      setError('Failed to load data.');
      return;
    }
    setError(null);
    if (data) {
      setGroups(data.map((row: { group: unknown }) => row.group as Group).filter(Boolean));
    }
  }

  return { groups, loading, error, refresh: () => setTick((t) => t + 1) };
}
