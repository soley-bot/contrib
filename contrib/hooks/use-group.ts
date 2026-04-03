import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!groupId) return;
    setLoading(true);
    fetchAll(groupId).finally(() => { if (mountedRef.current) setLoading(false); });

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

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [groupId, tick]);

  async function fetchAll(id: string) {
    const [groupResult, membersResult] = await Promise.all([
      supabase.from('groups').select('id, name, subject, due_date, lead_id, course_id, created_at').eq('id', id).single(),
      supabase.from('group_members').select('id, group_id, profile_id, joined_at, profile:profiles(id, name, university, faculty, year_of_study, avatar_url, role)').eq('group_id', id).order('joined_at', { ascending: true }),
    ]);
    if (groupResult.error || membersResult.error) {
      Sentry.captureMessage(`Failed to load group data: ${(groupResult.error || membersResult.error)?.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load data.');
      return;
    }
    if (!mountedRef.current) return;
    setError(null);
    setGroup((groupResult.data as Group) ?? null);
    setMembers((membersResult.data as unknown as GroupMember[]) ?? []);
  }

  const isLead = !!group && group.lead_id === userId;

  return { group, members, isLead, loading, error, refresh: () => setTick((t) => t + 1) };
}
