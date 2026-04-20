import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
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

async function fetchPage(groupId: string, offset: number): Promise<ActivityLog[]> {
  const { data, error: fetchError } = await supabase
    .from('activity_log')
    .select('id, group_id, actor_id, action, task_id, meta, created_at, actor:profiles!activity_log_actor_id_fkey(id, name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (fetchError) {
    Sentry.captureMessage(`Failed to load activity: ${fetchError.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data as unknown as ActivityLog[]) ?? [];
}

export function useActivity(groupId: string | undefined): UseActivityResult {
  // SWR owns page 0.
  const key = groupId ? ['activity', groupId, 'page0'] : null;
  const { data: firstPage, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchPage(id, 0));

  // Local state: rows prepended by the realtime INSERT channel.
  const [prepended, setPrepended] = useState<ActivityLog[]>([]);
  // Local state: rows appended by loadMore (pages 1, 2, ...).
  const [extraPages, setExtraPages] = useState<ActivityLog[]>([]);

  const [loadingMore, setLoadingMore] = useState(false);
  // hasMore: initialised from firstPage when it first arrives; updated by loadMore results.
  const [hasMore, setHasMore] = useState(false);
  const hasMoreInitRef = useRef(false);

  // Initialise hasMore from the first SWR response.
  useEffect(() => {
    if (firstPage !== undefined && !hasMoreInitRef.current) {
      hasMoreInitRef.current = true;
      setHasMore(firstPage.length === PAGE_SIZE);
    }
  }, [firstPage]);

  // Clear local overlay state when groupId changes.
  useEffect(() => {
    setPrepended([]);
    setExtraPages([]);
    setHasMore(false);
    hasMoreInitRef.current = false;
  }, [groupId]);

  // Realtime INSERT channel — prepend single enriched row.
  useEffect(() => {
    if (!groupId) return;
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
          .select('id, group_id, actor_id, action, task_id, meta, created_at, actor:profiles!activity_log_actor_id_fkey(id, name, avatar_url)')
          .eq('id', newEntry.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setPrepended((prev) => {
                if (prev.some((a) => a.id === (data as unknown as ActivityLog).id)) return prev;
                return [data as unknown as ActivityLog, ...prev];
              });
            }
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const loadMore = useCallback(() => {
    if (!groupId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    // DB offset = firstPage rows + already-loaded extra rows (prepended rows are NOT DB-paginated).
    const dbOffset = (firstPage?.length ?? 0) + extraPages.length;
    fetchPage(groupId, dbOffset).then((entries) => {
      setExtraPages((prev) => [...prev, ...entries]);
      setHasMore(entries.length === PAGE_SIZE);
      setLoadingMore(false);
    });
  }, [groupId, loadingMore, hasMore, firstPage, extraPages.length]);

  // Merge with dedup by id: prepended → firstPage → extraPages.
  const seenIds = new Set<string>();
  const activity: ActivityLog[] = [];
  for (const row of [...prepended, ...(firstPage ?? []), ...extraPages]) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id);
      activity.push(row);
    }
  }

  return {
    activity,
    loading: isLoading,
    loadingMore,
    hasMore,
    error: error ? (error as Error).message : null,
    loadMore,
    refresh: () => {
      setPrepended([]);
      setExtraPages([]);
      setHasMore(false);
      hasMoreInitRef.current = false;
      void mutate();
    },
  };
}
