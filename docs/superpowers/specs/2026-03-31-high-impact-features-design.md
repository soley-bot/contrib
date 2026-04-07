# High-Impact Features — Design Spec

**Date:** 2026-03-31
**Scope:** 6 features to make Contrib a proper useful tool

---

## 1. Deadline Reminders

**Trigger:** Vercel cron job, daily at 7:30 AM ICT (00:30 UTC)

**API Route:** `pages/api/cron/daily.ts`
- Verified via `CRON_SECRET` header (Vercel auto-sends)
- Uses `adminClient` from `lib/supabase-admin`
- Logs errors to Sentry

**vercel.json addition:**
```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "30 0 * * *" }] }
```

### Task-level reminders
1. Query tasks where `due_date = tomorrow` AND `status != 'done'` AND `deleted_at IS NULL`
2. Join with `groups` to get group name
3. For each task:
   - Insert in-app notification for the assignee (`notifications` table, type: `deadline_approaching`)
   - Call `notifyGroupMembers(groupId, message, 'deadlines')` — sends to all members with Telegram connected and `notify_deadlines = true`
   - Message format: `Task "[title]" in [group name] is due tomorrow`

### Group-level reminders
1. Query groups where `due_date = tomorrow`
2. For each group:
   - Get all group members via `group_members`
   - Insert in-app notification for each member
   - Call `notifyGroupMembers(groupId, message, 'deadlines')`
   - Message format: `Your group "[group name]" is due tomorrow`

### Notification type addition
- Add `deadline_approaching` to `NotificationType` in `types/index.ts`
- Add corresponding icon in `notification-bell.tsx`

---

## 2. Teacher Weekly Digest

**Trigger:** Same `/api/cron/daily` route, runs only on Mondays (checked via `new Date().getUTCDay()` adjusted for ICT)

### Logic
1. Query all profiles where `role = 'teacher'`
2. For each teacher, query their courses with groups, tasks, activity_log, and blocker_declarations
3. Build per-course summary:
   - Total groups and students
   - Task completion percentage
   - Number of overdue groups (due_date passed, tasks incomplete)
   - Unresolved blockers count
   - Inactive groups (no activity_log entry in 7+ days)
4. Send via Telegram (if teacher has Telegram connected)
5. Insert as in-app notification

### Telegram message format
```
Weekly Digest -- [Course Name]

Groups: [X] ([Y] students)
Completion: [Z]%
Overdue: [N] groups
Blockers: [N] unresolved
Inactive: [N] groups (7+ days)

View details at joincontrib.com/teacher
```

One message per course (not one giant message for all courses).

### Notification type addition
- Add `weekly_digest` to `NotificationType` in `types/index.ts`

---

## 3. Contribution Summary (Student Dashboard)

**Position:** Above the group list on `pages/dashboard.tsx`. Only shown if user has at least 1 completed task.

### New hook: `hooks/use-contribution-summary.ts`
- Query `tasks` where `assignee_id = userId` AND `status = 'done'` AND `deleted_at IS NULL`
- Group by `contribution_type`
- Return: `{ task: number, research: number, meeting: number, discussion: number, coordination: number, total: number }`

### New component: `components/contribution-summary.tsx`
- Horizontal bar chart, pure CSS (no chart library)
- Bar widths as percentages relative to the highest count
- Brand blue (`#1A56E8`) for all bars, light blue (`#EBF0FF`) for track
- Labels left-aligned (72px width on mobile, 85px on desktop)
- Counts right-aligned
- Header: "Your contributions" with total count on the right
- Mobile-responsive: works naturally since horizontal bars adapt to container width

### Visibility rules
- Hidden when user has 0 completed tasks
- Shows across all groups (aggregate view)

---

## 4. Teacher Summary Alert Banner

**Position:** On `pages/teacher/course/[id]/index.tsx`, above the existing stats pills. Only appears when there are actionable issues.

### Component changes (inline, no new component)
- Light amber background (`#FEF3C7`), border (`#FDE68A`), text (`#92400E`)
- SVG warning icon from `components/icons.tsx` (add `IconWarning` if not present)
- Single line format: `[icon] 2 groups overdue · 3 groups inactive (7+ days) · 1 unresolved blocker`
- Each segment clickable — activates the existing "Needs attention" filter
- Hidden when there are no issues (all groups on track)

### Data source
- Reuses existing `needsAttention()` function and computed values already in the page
- Add blocker count: query `blocker_declarations` for groups in this course, count unresolved (no new table needed — blockers already exist)

---

## 5. Timeline Pagination

**Affected files:** `pages/group/[id].tsx`, `components/group-timeline-tab.tsx`

### Changes to `group/[id].tsx`
- Initial activity query uses `.range(0, 19).order('created_at', { ascending: false })`
- Add state: `activityOffset` (number), `hasMoreActivity` (boolean)
- `loadMoreActivity()` function: fetches next 20 via `.range(offset, offset + 19)`, appends to existing array
- Set `hasMoreActivity = false` when fetch returns fewer than 20 entries
- Realtime subscription unchanged — new entries still prepend to the top

### Changes to `group-timeline-tab.tsx`
- Accept new props: `onLoadMore: () => void`, `hasMore: boolean`, `loadingMore: boolean`
- Add "Load more" button at the bottom of the timeline list
- Button styled as secondary (border, not filled): `border border-border bg-white hover:bg-bg-hover text-text-secondary`
- Shows "Loading..." while fetching
- Hidden when `hasMore` is false

---

## 6. Auto-Archive Groups

### Database migration
- Add `archived_at` column to `groups` table: `ALTER TABLE groups ADD COLUMN archived_at timestamptz DEFAULT NULL`
- Additive, backwards-compatible, no data loss

### Auto-archive logic (computed on dashboard load, not a cron)
A group is auto-archivable when:
- `due_date` is in the past AND all tasks have `status = 'done'` (or zero tasks exist)
- This is computed client-side using existing data from `useGroups` + `useDashboardSummary`

### Manual archive
- Group lead sees "Archive" button in group settings
- Sets `archived_at = now()` on the group
- "Unarchive" button reverses it (sets `archived_at = null`)

### Student dashboard changes (`pages/dashboard.tsx`)
- Split groups into two lists: active and archived/auto-archivable
- Active groups render as before
- "Past groups (N)" collapsible section below, collapsed by default
- Past group cards use muted style: lighter text (`text-text-tertiary`), no progress bar, just name + subject + completion date

### Teacher side
- No changes. Archived groups still appear in course drill-down. Teachers need historical data for grading.

---

## Shared Infrastructure

### vercel.json
Add cron configuration:
```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "30 0 * * *" }
  ]
}
```

### Environment variable
- `CRON_SECRET` — Vercel auto-provisions this for cron jobs. Verified in the API route header.

### Type changes (`types/index.ts`)
- Add `deadline_approaching` and `weekly_digest` to `NotificationType`

### Icon changes (`components/icons.tsx`)
- Add `IconWarning` (small triangle with exclamation) if not present
- Add `IconDeadline` (clock icon) for deadline notification type in bell dropdown

---

## What is NOT in scope

- Email notifications (deferred — Telegram only for now)
- Task/notification pagination (low risk at current scale)
- Contribution comparison between members (personal view only)
- Chat/comments (separate future feature)
