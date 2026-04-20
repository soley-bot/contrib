import { useEffect, useCallback } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
}

async function fetchNotifications([, userId]: [string, string]): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, recipient_id, group_id, type, title, body, meta, read_at, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    Sentry.captureMessage(`Failed to load notifications: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load notifications.');
  }
  return (data as Notification[]) ?? [];
}

export function useNotifications(userId: string | undefined): UseNotificationsResult {
  const key = userId ? ['notifications', userId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchNotifications);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, mutate]);

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id);
    if (updateError) {
      Sentry.captureMessage(`Failed to mark notification as read: ${updateError.message}`, { level: 'error' });
      return;
    }
    void mutate((prev) => prev?.map((n) => n.id === id ? { ...n, read_at: readAt } : n), { revalidate: false });
  }, [mutate]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (updateError) {
      Sentry.captureMessage(`Failed to mark all notifications as read: ${updateError.message}`, { level: 'error' });
      return;
    }
    void mutate((prev) => prev?.map((n) => n.read_at ? n : { ...n, read_at: readAt }), { revalidate: false });
  }, [userId, mutate]);

  return {
    notifications: data ?? [],
    unreadCount,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    markAsRead,
    markAllAsRead,
    refresh: () => { void mutate(); },
  };
}
