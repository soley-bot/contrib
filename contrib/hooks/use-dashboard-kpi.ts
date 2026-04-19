import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';

interface DashboardKpi {
  tasksToday: number;
  overdue: number;
  logsThisWeek: number;
  loading: boolean;
}

// Asia/Phnom_Penh is UTC+7 (no DST). Compute a local YYYY-MM-DD to match
// how due_date is stored (date column, no timezone).
function phnomPenhToday(): string {
  const now = new Date();
  const pp = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  const y = pp.getUTCFullYear();
  const m = String(pp.getUTCMonth() + 1).padStart(2, '0');
  const d = String(pp.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useDashboardKpi(userId: string | undefined): DashboardKpi {
  const [tasksToday, setTasksToday] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [logsThisWeek, setLogsThisWeek] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    async function fetchKpi(uid: string) {
      const today = phnomPenhToday();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Active groups the user is a member of; tasks/logs only count inside these.
      const membershipRes = await supabase
        .from('group_members')
        .select('group:groups(id, archived_at)')
        .eq('profile_id', uid);

      if (membershipRes.error) {
        Sentry.captureMessage(`Failed to load KPI memberships: ${membershipRes.error.message}`, { level: 'error' });
        if (!cancelled) { setLoading(false); }
        return;
      }

      // Supabase types the joined `group` as an array even for to-one relations, so we flatten defensively.
      const activeGroupIds: string[] = ((membershipRes.data ?? []) as unknown as { group: { id: string; archived_at: string | null } | { id: string; archived_at: string | null }[] | null }[])
        .flatMap((row) => (Array.isArray(row.group) ? row.group : row.group ? [row.group] : []))
        .filter((g) => g.archived_at === null)
        .map((g) => g.id);

      if (activeGroupIds.length === 0) {
        // Still need logsThisWeek (evidence is authored by user, not tied to membership filter).
        const evRes = await supabase
          .from('evidence')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', uid)
          .is('deleted_at', null)
          .gte('created_at', weekAgo);
        if (cancelled) return;
        setTasksToday(0);
        setOverdue(0);
        setLogsThisWeek(evRes.count ?? 0);
        setLoading(false);
        return;
      }

      const [todayRes, overdueRes, logsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assignee_id', uid)
          .eq('due_date', today)
          .neq('status', 'done')
          .is('deleted_at', null)
          .in('group_id', activeGroupIds),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assignee_id', uid)
          .lt('due_date', today)
          .neq('status', 'done')
          .is('deleted_at', null)
          .in('group_id', activeGroupIds),
        supabase
          .from('evidence')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', uid)
          .is('deleted_at', null)
          .gte('created_at', weekAgo),
      ]);

      if (cancelled) return;

      if (todayRes.error) Sentry.captureMessage(`KPI tasksToday failed: ${todayRes.error.message}`, { level: 'error' });
      if (overdueRes.error) Sentry.captureMessage(`KPI overdue failed: ${overdueRes.error.message}`, { level: 'error' });
      if (logsRes.error) Sentry.captureMessage(`KPI logsThisWeek failed: ${logsRes.error.message}`, { level: 'error' });

      setTasksToday(todayRes.count ?? 0);
      setOverdue(overdueRes.count ?? 0);
      setLogsThisWeek(logsRes.count ?? 0);
      setLoading(false);
    }

    fetchKpi(userId);
    return () => { cancelled = true; };
  }, [userId]);

  return { tasksToday, overdue, logsThisWeek, loading };
}
