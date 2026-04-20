import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types';

interface UseGroupsResult {
  groups: Group[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(id, name, subject, due_date, lead_id, course_id, archived_at, created_at)')
    .eq('profile_id', userId);
  if (error) {
    Sentry.captureMessage(`Failed to load groups: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data ?? []).map((row: { group: unknown }) => row.group as Group).filter(Boolean);
}

export function useGroups(userId: string | undefined): UseGroupsResult {
  const key = userId ? ['groups', userId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchGroups(id));

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-groups:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `profile_id=eq.${userId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, mutate]);

  return {
    groups: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
