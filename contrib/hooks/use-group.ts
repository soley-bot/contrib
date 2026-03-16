import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group, GroupMember } from '@/types';

interface UseGroupResult {
  group: Group | null;
  members: GroupMember[];
  isLead: boolean;
  loading: boolean;
  refresh: () => void;
}

export function useGroup(groupId: string | undefined, userId: string | undefined): UseGroupResult {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.all([fetchGroup(groupId), fetchMembers(groupId)]).finally(() =>
      setLoading(false)
    );
  }, [groupId, tick]);

  async function fetchGroup(id: string) {
    const { data } = await supabase.from('groups').select('*').eq('id', id).single();
    setGroup(data ?? null);
  }

  async function fetchMembers(id: string) {
    const { data } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', id)
      .order('joined_at', { ascending: true });
    setMembers((data as GroupMember[]) ?? []);
  }

  const isLead = !!group && group.lead_id === userId;

  return { group, members, isLead, loading, refresh: () => setTick((t) => t + 1) };
}
