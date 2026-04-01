import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { ActivityLog } from '@/types';

const PAGE_SIZE = 20;

interface UseActivityResult {
  activity: ActivityLog[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

export function useActivity(groupId: string | undefined): UseActivityResult {
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const mountedRef = useRef(true);

  async function fetchPage(id: string, offset: number): Promise<ActivityLog[]> {
    const { data, error: fetchError } = await supabase
      .from('activity_log')
      .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchError) {
      Sentry.captureMessage(`Failed to load activity: ${fetchError.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load data.');
      return [];
    }
    if (mountedRef.current) setError(null);
    return (data as ActivityLog[]) ?? [];
  }

  useEffect(() => {
    mountedRef.current = true;
    if (!groupId) { setLoading(false); return; }
    setLoading(true);
    fetchPage(groupId, 0).then((entries) => {
      if (!mountedRef.current) return;
      setActivity(entries);
      setHasMore(entries.length === PAGE_SIZE);
      setLoading(false);
    });

    const channel = supabase
      .channel(`activity:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const newEntry = payload.new as ActivityLog;
        supabase
          .from('activity_log')
          .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
          .eq('id', newEntry.id)
          .single()
          .then(({ data }) => {
            if (data && mountedRef.current) {
              setActivity((prev) => {
                if (prev.some((a) => a.id === data.id)) return prev;
                return [data as ActivityLog, ...prev];
              });
            }
          });
      })
      .subscribe();

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [groupId, tick]);

  const loadMore = useCallback(() => {
    if (!groupId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(groupId, activity.length).then((entries) => {
      setActivity((prev) => [...prev, ...entries]);
      setHasMore(entries.length === PAGE_SIZE);
      setLoadingMore(false);
    });
  }, [groupId, loadingMore, hasMore, activity.length]);

  return {
    activity,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh: () => setTick((t) => t + 1),
  };
}
