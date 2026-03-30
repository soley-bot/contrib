import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group, GroupMember } from '@/types';

interface UseGroupResult {
  group: Group | null;
  members: GroupMember[];
  isLead: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGroup(groupId: string | undefined, userId: string | undefined): UseGroupResult {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    fetchAll(groupId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`group-members:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchAll(groupId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, tick]);

  async function fetchAll(id: string) {
    const [groupResult, membersResult] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', id).order('joined_at', { ascending: true }),
    ]);
    if (groupResult.error || membersResult.error) {
      console.error('Failed to load group data:', groupResult.error || membersResult.error);
      setError('Failed to load data.');
      return;
    }
    setError(null);
    setGroup(groupResult.data ?? null);
    setMembers((membersResult.data as GroupMember[]) ?? []);
  }

  const isLead = !!group && group.lead_id === userId;

  return { group, members, isLead, loading, error, refresh: () => setTick((t) => t + 1) };
}
