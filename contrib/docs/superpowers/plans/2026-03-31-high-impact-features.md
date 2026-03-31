# High-Impact Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 features — deadline reminders, teacher digest, contribution summary, teacher alert banner, timeline pagination, and auto-archive groups — to make Contrib a proper useful tool.

**Architecture:** Single Vercel cron job (`/api/cron/daily`) handles deadline reminders (daily) and teacher digest (Mondays). Contribution summary and teacher alert banner are pure frontend additions using existing data. Timeline pagination modifies the `useActivity` hook to use Supabase `.range()`. Auto-archive adds an `archived_at` column and splits the dashboard group list.

**Tech Stack:** Next.js Pages Router, Supabase (Postgres + Realtime), TypeScript, Tailwind CSS, Vercel Cron Jobs

**Spec:** `docs/superpowers/specs/2026-03-31-high-impact-features-design.md`

**Key files to read before starting:**
- `CLAUDE.md` — project constraints, API route patterns, shared helpers
- `types/index.ts` — all shared types
- `lib/notify.ts` — `notifyGroupMembers()` function
- `lib/supabase-admin.ts` — `adminClient` (server-side, bypasses RLS)
- `components/icons.tsx` — SVG icon pattern
- `hooks/use-activity.ts` — current activity loading (no pagination)
- `hooks/use-groups.ts` — current group loading
- `hooks/use-dashboard-summary.ts` — dashboard summary data
- `pages/dashboard.tsx` — student dashboard
- `pages/teacher/course/[id]/index.tsx` — teacher course detail page

---

### Task 1: Add shared types and icons

**Files:**
- Modify: `types/index.ts`
- Modify: `components/icons.tsx`

- [ ] **Step 1: Add new notification types to `types/index.ts`**

In `types/index.ts`, update the `NotificationType` union:

```ts
// Replace:
export type NotificationType = 'task_assigned' | 'task_reassigned' | 'evaluation_opened' | 'member_joined' | 'evidence_added' | 'blocker_declared';

// With:
export type NotificationType = 'task_assigned' | 'task_reassigned' | 'evaluation_opened' | 'member_joined' | 'evidence_added' | 'blocker_declared' | 'deadline_approaching' | 'weekly_digest';
```

- [ ] **Step 2: Add `IconWarning` and `IconClock` to `components/icons.tsx`**

Append these two icons to the end of the file (before the closing `Logo` component — insert above the `export function Logo` line):

```tsx
export function IconWarning({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L1.5 13h13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
export function IconClock({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
```

Note: `IconAlertTriangle` already exists at line 121. `IconWarning` is a duplicate — use `IconAlertTriangle` instead. Skip adding `IconWarning` and only add `IconClock`.

- [ ] **Step 3: Add notification type icons for `deadline_approaching` and `weekly_digest` in `notification-bell.tsx`**

In `components/notification-bell.tsx`, find the `NotificationTypeIcon` switch statement and add two new cases before the `default`:

```tsx
    case 'deadline_approaching':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'weekly_digest':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add types/index.ts components/icons.tsx components/notification-bell.tsx
git commit -m "Add deadline_approaching and weekly_digest notification types and icons"
```

---

### Task 2: Cron infrastructure + deadline reminders

**Files:**
- Create: `pages/api/cron/daily.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `pages/api/cron/daily.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { notifyGroupMembers } from '@/lib/notify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // Verify cron secret (Vercel sends this automatically)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: { deadlines: number; digest: number } = { deadlines: 0, digest: 0 };

  try {
    results.deadlines = await sendDeadlineReminders();
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'cron/daily', job: 'deadlines' } });
  }

  try {
    // Teacher digest runs only on Mondays (ICT = UTC+7, cron runs at 00:30 UTC = 7:30 AM ICT)
    const nowICT = new Date(Date.now() + 7 * 60 * 60 * 1000);
    if (nowICT.getUTCDay() === 1) {
      results.digest = await sendTeacherDigest();
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'cron/daily', job: 'digest' } });
  }

  return res.status(200).json({ ok: true, ...results });
}

async function sendDeadlineReminders(): Promise<number> {
  // Calculate tomorrow's date in ICT (UTC+7)
  const nowICT = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const tomorrow = new Date(nowICT);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  let count = 0;

  // --- Task-level reminders ---
  const { data: tasks, error: taskErr } = await adminClient
    .from('tasks')
    .select('id, title, group_id, assignee_id, groups!inner(name)')
    .eq('due_date', tomorrowStr)
    .neq('status', 'done')
    .is('deleted_at', null);

  if (taskErr) {
    Sentry.captureMessage(`[cron/daily] task query error: ${taskErr.message}`, { level: 'error', tags: { route: 'cron/daily' } });
  }

  if (tasks) {
    for (const task of tasks) {
      const groupName = (task as unknown as { groups: { name: string } }).groups?.name ?? '';
      const message = `Task "${task.title}" in ${groupName} is due tomorrow`;

      // In-app notification for assignee
      await adminClient.from('notifications').insert({
        recipient_id: task.assignee_id,
        group_id: task.group_id,
        type: 'deadline_approaching',
        title: message,
        meta: { taskId: task.id, groupName },
      });

      // Telegram to group (don't exclude anyone — everyone should know about deadlines)
      await notifyGroupMembers(task.group_id, message, 'deadlines');
      count++;
    }
  }

  // --- Group-level reminders ---
  const { data: groups, error: groupErr } = await adminClient
    .from('groups')
    .select('id, name')
    .eq('due_date', tomorrowStr);

  if (groupErr) {
    Sentry.captureMessage(`[cron/daily] group query error: ${groupErr.message}`, { level: 'error', tags: { route: 'cron/daily' } });
  }

  if (groups) {
    for (const group of groups) {
      const message = `Your group "${group.name}" is due tomorrow`;

      // Get all members to insert in-app notifications
      const { data: members } = await adminClient
        .from('group_members')
        .select('profile_id')
        .eq('group_id', group.id);

      if (members) {
        const notifications = members.map((m: { profile_id: string }) => ({
          recipient_id: m.profile_id,
          group_id: group.id,
          type: 'deadline_approaching' as const,
          title: message,
          meta: { groupName: group.name },
        }));
        await adminClient.from('notifications').insert(notifications);
      }

      // Telegram to group
      await notifyGroupMembers(group.id, message, 'deadlines');
      count++;
    }
  }

  return count;
}

async function sendTeacherDigest(): Promise<number> {
  // Placeholder — implemented in Task 3
  return 0;
}
```

- [ ] **Step 2: Update `vercel.json` with cron config**

Replace the contents of `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "30 0 * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add pages/api/cron/daily.ts vercel.json
git commit -m "Add daily cron job with deadline reminders (task-level + group-level)"
```

---

### Task 3: Teacher weekly digest

**Files:**
- Modify: `pages/api/cron/daily.ts` (replace the `sendTeacherDigest` placeholder)

- [ ] **Step 1: Replace the `sendTeacherDigest` function in `pages/api/cron/daily.ts`**

Replace the placeholder function at the bottom of the file:

```ts
async function sendTeacherDigest(): Promise<number> {
  // Get all teachers
  const { data: teachers, error: teacherErr } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'teacher');

  if (teacherErr || !teachers?.length) return 0;

  let count = 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const teacher of teachers) {
    // Get teacher's courses
    const { data: courses } = await adminClient
      .from('courses')
      .select('id, name')
      .eq('teacher_id', teacher.id);

    if (!courses?.length) continue;

    for (const course of courses) {
      // Get groups in this course
      const { data: groups } = await adminClient
        .from('groups')
        .select('id, name, due_date')
        .eq('course_id', course.id);

      if (!groups?.length) continue;

      const groupIds = groups.map((g: { id: string }) => g.id);

      // Get member counts
      const { data: members } = await adminClient
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);
      const studentCount = members?.length ?? 0;

      // Get task stats
      const { data: tasks } = await adminClient
        .from('tasks')
        .select('group_id, status')
        .in('group_id', groupIds)
        .is('deleted_at', null);
      const totalTasks = tasks?.length ?? 0;
      const doneTasks = tasks?.filter((t: { status: string }) => t.status === 'done').length ?? 0;
      const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // Count overdue groups
      const today = new Date().toISOString().split('T')[0];
      const overdueGroups = groups.filter((g: { due_date: string | null }) =>
        g.due_date && g.due_date < today
      );
      // Filter to only groups that still have incomplete tasks
      const overdueGroupIds = new Set(overdueGroups.map((g: { id: string }) => g.id));
      const overdueWithIncompleteTasks = tasks
        ? [...new Set(tasks.filter((t: { group_id: string; status: string }) =>
            overdueGroupIds.has(t.group_id) && t.status !== 'done'
          ).map((t: { group_id: string }) => t.group_id))].length
        : 0;

      // Count unresolved blockers
      const { count: blockerCount } = await adminClient
        .from('blocker_declarations')
        .select('id', { count: 'exact', head: true })
        .in('group_id', groupIds);

      // Count inactive groups (no activity in 7+ days)
      const { data: recentActivity } = await adminClient
        .from('activity_log')
        .select('group_id')
        .in('group_id', groupIds)
        .gte('created_at', sevenDaysAgo);
      const activeGroupIds = new Set((recentActivity ?? []).map((a: { group_id: string }) => a.group_id));
      const inactiveCount = groupIds.filter((id: string) => !activeGroupIds.has(id)).length;

      // Build message
      const lines = [
        `Weekly Digest -- ${course.name}`,
        '',
        `Groups: ${groups.length} (${studentCount} students)`,
        `Completion: ${completionPct}%`,
      ];
      if (overdueWithIncompleteTasks > 0) lines.push(`Overdue: ${overdueWithIncompleteTasks} groups`);
      if ((blockerCount ?? 0) > 0) lines.push(`Blockers: ${blockerCount} unresolved`);
      if (inactiveCount > 0) lines.push(`Inactive: ${inactiveCount} groups (7+ days)`);
      lines.push('', 'View details at joincontrib.com/teacher');

      const message = lines.join('\n');

      // Send via Telegram (teacher needs to be in at least one group for notifyGroupMembers,
      // so we send directly via telegram subscription)
      const { data: sub } = await adminClient
        .from('telegram_subscriptions')
        .select('chat_id')
        .eq('profile_id', teacher.id)
        .eq('verified', true)
        .eq('notify_weekly_digest', true)
        .maybeSingle();

      if (sub?.chat_id) {
        const { sendTelegramMessage } = await import('@/lib/telegram');
        await sendTelegramMessage(String(sub.chat_id), message);
      }

      // In-app notification
      await adminClient.from('notifications').insert({
        recipient_id: teacher.id,
        group_id: null,
        type: 'weekly_digest',
        title: `Weekly Digest -- ${course.name}`,
        body: message,
        meta: { courseId: course.id, courseName: course.name },
      });

      count++;
    }
  }

  return count;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add pages/api/cron/daily.ts
git commit -m "Add teacher weekly digest to daily cron job (Mondays, Telegram + in-app)"
```

---

### Task 4: Contribution summary hook and component

**Files:**
- Create: `hooks/use-contribution-summary.ts`
- Create: `components/contribution-summary.tsx`
- Modify: `pages/dashboard.tsx`

- [ ] **Step 1: Create `hooks/use-contribution-summary.ts`**

```ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ContributionType } from '@/types';

export interface ContributionCounts {
  task: number;
  research: number;
  meeting: number;
  discussion: number;
  coordination: number;
  total: number;
}

const EMPTY: ContributionCounts = { task: 0, research: 0, meeting: 0, discussion: 0, coordination: 0, total: 0 };

export function useContributionSummary(userId: string | undefined): { counts: ContributionCounts; loading: boolean } {
  const [counts, setCounts] = useState<ContributionCounts>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('contribution_type')
        .eq('assignee_id', userId)
        .eq('status', 'done')
        .is('deleted_at', null);

      if (error || !data) { setLoading(false); return; }

      const result: ContributionCounts = { ...EMPTY };
      for (const row of data as { contribution_type: ContributionType }[]) {
        const t = row.contribution_type ?? 'task';
        if (t in result) result[t]++;
        result.total++;
      }
      setCounts(result);
      setLoading(false);
    })();
  }, [userId]);

  return { counts, loading };
}
```

- [ ] **Step 2: Create `components/contribution-summary.tsx`**

```tsx
import { CONTRIBUTION_TYPES } from '@/types';
import type { ContributionCounts } from '@/hooks/use-contribution-summary';

interface ContributionSummaryProps {
  counts: ContributionCounts;
}

export default function ContributionSummary({ counts }: ContributionSummaryProps) {
  if (counts.total === 0) return null;

  const max = Math.max(counts.task, counts.research, counts.meeting, counts.discussion, counts.coordination, 1);

  const rows: { label: string; value: number }[] = CONTRIBUTION_TYPES
    .map((t) => ({ label: t.label, value: counts[t.value] }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-text">Your contributions</span>
        <span className="text-[12px] text-text-tertiary">{counts.total} total</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 md:gap-2">
            <div className="w-[72px] md:w-[85px] text-[11px] md:text-[12px] text-text-secondary text-right flex-shrink-0">
              {row.label}
            </div>
            <div className="flex-1 h-4 md:h-[18px] bg-brand-light rounded overflow-hidden">
              <div
                className="h-full bg-brand rounded transition-all"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
            <div className="w-4 md:w-5 text-[11px] md:text-[12px] text-text-secondary font-medium flex-shrink-0">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add contribution summary to `pages/dashboard.tsx`**

Add the import at the top of `dashboard.tsx`, alongside the other imports:

```ts
import { useContributionSummary } from '@/hooks/use-contribution-summary';
import ContributionSummary from '@/components/contribution-summary';
```

Inside the `Dashboard` component, after the existing hook calls (after the `useCourseMemberships` line), add:

```ts
const { counts: contributionCounts } = useContributionSummary(user?.id);
```

In the JSX, add the `<ContributionSummary>` component right before the groups list. Find this line in the template:

```tsx
{groupsLoading ? (
```

And insert the contribution summary just before it:

```tsx
<ContributionSummary counts={contributionCounts} />
{groupsLoading ? (
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add hooks/use-contribution-summary.ts components/contribution-summary.tsx pages/dashboard.tsx
git commit -m "Add personal contribution summary bar chart to student dashboard"
```

---

### Task 5: Teacher alert banner on course page

**Files:**
- Modify: `pages/teacher/course/[id]/index.tsx`

- [ ] **Step 1: Add blocker count state and fetch**

In `pages/teacher/course/[id]/index.tsx`, add a new state variable near the other state declarations (around line 43):

```ts
const [blockerCounts, setBlockerCounts] = useState<Record<string, number>>({});
```

Add a new `useEffect` after the existing `ungroupedStudents` effect (after line 107) to fetch blocker counts:

```ts
useEffect(() => {
  if (groupIds.length === 0) return;
  (async () => {
    const { data } = await supabase
      .from('blocker_declarations')
      .select('group_id')
      .in('group_id', groupIds);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row: { group_id: string }) => {
      counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
    });
    setBlockerCounts(counts);
  })();
}, [groupIds.join(',')]);
```

- [ ] **Step 2: Compute alert banner values**

After the existing `attentionCount` computation (around line 259), add:

```ts
const totalBlockers = Object.values(blockerCounts).reduce((s, c) => s + c, 0);
const inactiveCount = groups.filter(({ group }) => {
  const lastAct = latestActivity[group.id];
  if (!lastAct) return true;
  return (todayDate.getTime() - new Date(lastAct).getTime()) >= THREE_DAYS_MS;
}).length;
const showAlertBanner = overdueCount > 0 || inactiveCount > 0 || totalBlockers > 0;
```

- [ ] **Step 3: Add the alert banner JSX**

In the JSX, find the stats pills section (the `<div className="flex gap-2.5 mb-3 overflow-x-auto pb-1"` around line 352). Insert the alert banner immediately BEFORE the stats pills:

```tsx
{showAlertBanner && (
  <button
    onClick={() => setFilterMode('attention')}
    className="w-full mb-3 px-3 py-2.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg flex items-center gap-2 text-left transition-colors hover:bg-[#FDE68A]/50"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[#92400E]">
      <path d="M8 1.5L1.5 13h13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <span className="text-[13px] text-[#92400E] font-medium">
      {[
        overdueCount > 0 ? `${overdueCount} group${overdueCount > 1 ? 's' : ''} overdue` : '',
        inactiveCount > 0 ? `${inactiveCount} group${inactiveCount > 1 ? 's' : ''} inactive (7+ days)` : '',
        totalBlockers > 0 ? `${totalBlockers} unresolved blocker${totalBlockers > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(' · ')}
    </span>
  </button>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add pages/teacher/course/[id]/index.tsx
git commit -m "Add alert banner to teacher course page for overdue, inactive, and blocked groups"
```

---

### Task 6: Timeline pagination

**Files:**
- Modify: `hooks/use-activity.ts`
- Modify: `components/group-timeline-tab.tsx`

- [ ] **Step 1: Add pagination to `hooks/use-activity.ts`**

Replace the entire contents of `hooks/use-activity.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    setLoading(true);
    fetchPage(groupId, 0).then((entries) => {
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
        // Prepend new realtime entry
        const newEntry = payload.new as ActivityLog;
        // Fetch the full entry with actor profile
        supabase
          .from('activity_log')
          .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
          .eq('id', newEntry.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setActivity((prev) => {
                // Avoid duplicates
                if (prev.some((a) => a.id === data.id)) return prev;
                return [data as ActivityLog, ...prev];
              });
            }
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, tick]);

  async function fetchPage(id: string, offset: number): Promise<ActivityLog[]> {
    const { data, error: fetchError } = await supabase
      .from('activity_log')
      .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchError) {
      Sentry_safe_log(fetchError.message);
      setError('Failed to load data.');
      return [];
    }
    setError(null);
    return (data as ActivityLog[]) ?? [];
  }

  const loadMore = useCallback(() => {
    if (!groupId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = activity.length;
    fetchPage(groupId, offset).then((entries) => {
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

// Safe log helper — avoids console.error in production
function Sentry_safe_log(msg: string) {
  try {
    // Dynamic import to avoid bundling Sentry in client
    console.warn('[activity]', msg);
  } catch {}
}
```

- [ ] **Step 2: Update `group-timeline-tab.tsx` to accept pagination props**

Replace the entire contents of `components/group-timeline-tab.tsx`:

```tsx
import FeedItem from '@/components/feed-item';
import InlineTip from '@/components/inline-tip';
import type { ActivityLog } from '@/types';

interface GroupTimelineTabProps {
  activity: ActivityLog[];
  onShowBlockerModal: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

export default function GroupTimelineTab({ activity, onShowBlockerModal, onLoadMore, hasMore, loadingMore }: GroupTimelineTabProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
      <InlineTip id="timeline-blocker">Use the &quot;Heads Up&quot; button to flag blockers. Your team and teacher will see it here in the Timeline.</InlineTip>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Recent activity</p>
        <button
          onClick={onShowBlockerModal}
          className="h-7 px-3 border border-border bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[12px] font-medium text-muted hover:text-[#DC2626] rounded-md flex items-center gap-1.5 transition-colors"
        >
          Heads Up
        </button>
      </div>
      {activity.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <svg viewBox="0 0 120 90" fill="none" className="w-28 mx-auto mb-4 opacity-80">
            <ellipse cx="60" cy="82" rx="44" ry="6" fill="#F1F5F9"/>
            <circle cx="60" cy="42" r="28" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2"/>
            <circle cx="60" cy="42" r="22" fill="white"/>
            <line x1="60" y1="42" x2="60" y2="26" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="60" y1="42" x2="70" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="60" cy="42" r="2.5" fill="#94A3B8"/>
            <line x1="60" y1="22" x2="60" y2="25" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="60" y1="59" x2="60" y2="62" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="40" y1="42" x2="43" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="77" y1="42" x2="80" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-[14px] font-semibold text-text-secondary mb-1">No activity yet</p>
          <p className="text-sm text-text-tertiary">Actions will appear here as your team works.</p>
        </div>
      ) : (
        <>
          {activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="h-9 px-5 border border-border bg-white hover:bg-bg-hover text-[13px] font-medium text-text-secondary rounded-md transition-colors disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `group/[id].tsx` to pass pagination props**

In `pages/group/[id].tsx`, the `useActivity` hook is already called. The return value now includes `loadMore`, `hasMore`, and `loadingMore`. Find where `GroupTimelineTab` is rendered and update the props.

Find this line:

```tsx
<GroupTimelineTab activity={activity} onShowBlockerModal={() => setShowBlockerModal(true)} />
```

Replace with:

```tsx
<GroupTimelineTab
  activity={activity}
  onShowBlockerModal={() => setShowBlockerModal(true)}
  onLoadMore={loadMore}
  hasMore={hasMore}
  loadingMore={loadingMore}
/>
```

Also update the destructured hook at the top — find:

```ts
const { activity, refresh: refreshActivity } = useActivity(groupId);
```

Replace with:

```ts
const { activity, loadMore, hasMore, loadingMore, refresh: refreshActivity } = useActivity(groupId);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add hooks/use-activity.ts components/group-timeline-tab.tsx pages/group/[id].tsx
git commit -m "Add timeline pagination — load 20 entries at a time with 'Load more' button"
```

---

### Task 7: Auto-archive groups

**Files:**
- Create: `database/supabase-archive-groups.sql` (migration reference)
- Create: `pages/api/groups/[id]/archive.ts`
- Modify: `pages/dashboard.tsx`

- [ ] **Step 1: Create the migration SQL file**

Create `database/supabase-archive-groups.sql` as a reference (to be run via Supabase MCP or dashboard):

```sql
-- Add archived_at column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
```

- [ ] **Step 2: Run the migration**

Execute the SQL via Supabase MCP tool `execute_sql` or run it in the Supabase dashboard SQL editor.

- [ ] **Step 3: Create `pages/api/groups/[id]/archive.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`archive:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id as string;
  if (!groupId) return res.status(400).json({ error: 'Missing group ID.' });

  // Verify user is lead of this group
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id, archived_at')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (group.lead_id !== user.id) return res.status(403).json({ error: 'Only the group lead can archive.' });

  const { action } = req.body as { action?: string };
  const archivedAt = action === 'unarchive' ? null : new Date().toISOString();

  const { error } = await adminClient
    .from('groups')
    .update({ archived_at: archivedAt })
    .eq('id', groupId);

  if (error) {
    Sentry.captureMessage(`[groups/archive] error: ${error.message}`, { level: 'error', tags: { route: 'groups/archive' } });
    return res.status(500).json({ error: 'Failed to update group.' });
  }

  return res.status(200).json({ ok: true, archived: action !== 'unarchive' });
}
```

- [ ] **Step 4: Update `types/index.ts` — add `archived_at` to Group interface**

In `types/index.ts`, update the `Group` interface:

```ts
export interface Group {
  id: string;
  name: string;
  subject: string;
  due_date: string | null;
  lead_id: string;
  invite_token: string;
  course_id: string | null;
  archived_at: string | null;
  created_at: string;
}
```

- [ ] **Step 5: Update `pages/dashboard.tsx` — split groups into active and past**

Add a new state and computed values inside the `Dashboard` component. After the `useDashboardSummary` line, add:

```ts
const [showPastGroups, setShowPastGroups] = useState(false);
```

After the `summaries` line, add the split logic:

```ts
const todayStr = new Date().toISOString().split('T')[0];
const activeGroups = groups.filter((group) => {
  // Manually archived
  if (group.archived_at) return false;
  // Auto-archivable: due date passed AND all tasks done
  const s = summaries[group.id];
  if (group.due_date && group.due_date < todayStr && s && s.taskTotal > 0 && s.taskDone === s.taskTotal) return false;
  return true;
});
const pastGroups = groups.filter((group) => !activeGroups.includes(group));
```

In the JSX, replace the existing `groups.map(...)` rendering block with `activeGroups.map(...)` (same code, just iterate over `activeGroups` instead of `groups`).

After the active groups list (and after the "No groups yet" empty state), add the past groups section:

```tsx
{pastGroups.length > 0 && (
  <div className="mt-4">
    <button
      onClick={() => setShowPastGroups(!showPastGroups)}
      className="flex items-center gap-1.5 text-[13px] font-medium text-text-tertiary hover:text-text-secondary transition-colors mb-2"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`transition-transform ${showPastGroups ? 'rotate-90' : ''}`}>
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Past groups ({pastGroups.length})
    </button>
    {showPastGroups && (
      <div className="flex flex-col gap-2">
        {pastGroups.map((group) => (
          <div
            key={group.id}
            onClick={() => router.push(`/group/${group.id}`)}
            className="bg-white border border-border rounded-xl p-3.5 cursor-pointer hover:border-brand/40 transition-colors opacity-70"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-bg-hover text-text-tertiary font-bold text-sm flex items-center justify-center flex-shrink-0">
                {group.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-text-secondary truncate">{group.name}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{group.subject} · Completed</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

Also update the empty state condition and loading skeleton to use `activeGroups` instead of `groups`:

Find: `groups.length === 0 ?` and replace with: `activeGroups.length === 0 && pastGroups.length === 0 ?`

Find: the groups map `groups.map((group) => {` and replace with: `activeGroups.map((group) => {`

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add database/supabase-archive-groups.sql pages/api/groups/[id]/archive.ts types/index.ts pages/dashboard.tsx
git commit -m "Add auto-archive for completed groups with manual archive/unarchive support"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd contrib && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify all files are committed**

Run: `cd contrib && git status`
Expected: Working tree clean

- [ ] **Step 4: Final commit if needed and push**

If any remaining changes:
```bash
git add -A && git commit -m "Final cleanup for high-impact features"
```

Push:
```bash
git push origin main
```
