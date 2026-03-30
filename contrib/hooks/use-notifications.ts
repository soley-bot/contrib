import { useState, useEffect, useCallback } from 'react';
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

export function useNotifications(userId: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchNotifications(userId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        fetchNotifications(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, tick]);

  async function fetchNotifications(uid: string) {
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (fetchError) {
      console.error('Failed to load notifications:', fetchError);
      setError('Failed to load notifications.');
      return;
    }
    setError(null);
    setNotifications((data as Notification[]) ?? []);
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) {
      console.error('Failed to mark notification as read:', updateError);
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (updateError) {
      console.error('Failed to mark all notifications as read:', updateError);
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => n.read_at ? n : { ...n, read_at: new Date().toISOString() })
    );
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: () => setTick((t) => t + 1),
  };
}
