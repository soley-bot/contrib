import { useEffect } from 'react';
import useSWR from 'swr';
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

interface GroupData {
  group: Group;
  members: GroupMember[];
}

async function fetchGroupData(groupId: string): Promise<GroupData> {
  const [groupResult, membersResult] = await Promise.all([
    supabase.from('groups').select('id, name, subject, due_date, lead_id, course_id, invite_token, created_by, archived_at, created_at').eq('id', groupId).single(),
    supabase.from('group_members').select('id, group_id, profile_id, joined_at, profile:profiles(id, name, university, faculty, year_of_study, avatar_url, role)').eq('group_id', groupId).order('joined_at', { ascending: true }),
  ]);
  if (groupResult.error || membersResult.error) {
    Sentry.captureMessage(`Failed to load group data: ${(groupResult.error || membersResult.error)?.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return {
    group: groupResult.data as Group,
    members: (membersResult.data as unknown as GroupMember[]) ?? [],
  };
}

export function useGroup(groupId: string | undefined, userId: string | undefined): UseGroupResult {
  const key = groupId ? ['group', groupId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchGroupData(id));

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-members:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, mutate]);

  const isLead = !!data?.group && data.group.lead_id === userId;

  return {
    group: data?.group ?? null,
    members: data?.members ?? [],
    isLead,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
