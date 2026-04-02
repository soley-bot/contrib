# Task Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flat discussion comments to tasks, visible below evidence in the TaskModal, with realtime updates, notifications, and soft delete.

**Architecture:** New `task_comments` table with RLS, a realtime hook following the `use-evidence` pattern, a single `TaskComments` component (list + input), integrated into the existing `TaskModal`. Notifications reuse the existing `/api/notify` endpoint and in-app `notifications` table.

**Tech Stack:** Supabase (Postgres + RLS + Realtime), Next.js Pages Router, TypeScript, Zod, Sentry, Tailwind CSS v4

---

### Task 1: Database Migration

**Files:**
- Create: `database/supabase-task-comments-migration.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Task Comments migration
-- Run in Supabase SQL Editor

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id      uuid        NOT NULL REFERENCES public.profiles(id),
  content        text        NOT NULL,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- 3. SELECT: group members can read non-deleted comments
CREATE POLICY "Group members can read comments"
  ON public.task_comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE t.id = task_comments.task_id
        AND gm.profile_id = auth.uid()
    )
  );

-- 4. INSERT: users can insert own comments
CREATE POLICY "Users can insert own comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 5. UPDATE: users can soft-delete own comments (or group lead)
CREATE POLICY "Users can soft-delete own comments"
  ON public.task_comments FOR UPDATE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.groups g ON g.id = t.group_id
      WHERE t.id = task_comments.task_id
        AND g.lead_id = auth.uid()
    )
  );

-- 6. Index for fast lookups by task
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
  ON public.task_comments (task_id);

-- 7. Enable realtime for task_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- 8. Update activity_log action constraint
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_check CHECK (
    action IN (
      'task_created', 'task_assigned', 'task_updated', 'task_done',
      'file_uploaded', 'evidence_added', 'evidence_version_added',
      'member_joined', 'task_edited', 'task_deleted', 'task_reassigned',
      'group_updated', 'member_left', 'member_removed', 'lead_transferred',
      'evaluation_opened', 'evaluation_submitted',
      'report_shared', 'report_exported', 'blocker_declared',
      'comment_added'
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add database/supabase-task-comments-migration.sql
git commit -m "feat: add task_comments migration with RLS and realtime"
```

---

### Task 2: Types and Validation

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/validation.ts`

- [ ] **Step 1: Add TaskComment type and update NotificationType**

In `types/index.ts`, add after the `BlockerDeclaration` interface (around line 169):

```typescript
export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  deleted_at: string | null;
  created_at: string;
  author?: Profile;
}
```

Update the `ActivityAction` type to include `'comment_added'`:

```typescript
export type ActivityAction =
  | 'task_created'
  | 'task_assigned'
  | 'task_updated'
  | 'task_done'
  | 'file_uploaded'
  | 'evidence_added'
  | 'evidence_version_added'
  | 'member_joined'
  | 'task_edited'
  | 'task_deleted'
  | 'task_reassigned'
  | 'group_updated'
  | 'member_left'
  | 'member_removed'
  | 'lead_transferred'
  | 'evaluation_opened'
  | 'evaluation_submitted'
  | 'report_shared'
  | 'report_exported'
  | 'blocker_declared'
  | 'comment_added';
```

Update the `NotificationType` to include `'task_comment'`:

```typescript
export type NotificationType = 'task_assigned' | 'task_reassigned' | 'evaluation_opened' | 'member_joined' | 'evidence_added' | 'blocker_declared' | 'deadline_approaching' | 'weekly_digest' | 'task_comment';
```

- [ ] **Step 2: Add Zod validation schema**

In `lib/validation.ts`, add after the `reportShareSchema`:

```typescript
export const taskCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty.').max(2000, 'Comment is too long (max 2000 characters).'),
});
```

- [ ] **Step 3: Verify types compile**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/validation.ts
git commit -m "feat: add TaskComment type, comment_added action, and validation schema"
```

---

### Task 3: Realtime Hook

**Files:**
- Create: `hooks/use-task-comments.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { TaskComment } from '@/types';

interface UseTaskCommentsResult {
  comments: TaskComment[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTaskComments(taskId: string | undefined): UseTaskCommentsResult {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!taskId) { setComments([]); setLoading(false); return; }
    setLoading(true);
    fetchComments(taskId).finally(() => { if (mountedRef.current) setLoading(false); });

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
      }, () => {
        fetchComments(taskId);
      })
      .subscribe();

    return () => { mountedRef.current = false; supabase.removeChannel(channel); };
  }, [taskId, tick]);

  async function fetchComments(id: string) {
    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select('*, author:profiles!task_comments_author_id_fkey(*)')
      .eq('task_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (fetchError) {
      Sentry.captureMessage(`Failed to load comments: ${fetchError.message}`, { level: 'error' });
      if (mountedRef.current) setError('Failed to load comments.');
      return;
    }
    if (!mountedRef.current) return;
    setError(null);
    setComments((data as TaskComment[]) ?? []);
  }

  return { comments, loading, error, refresh: () => setTick((t) => t + 1) };
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/use-task-comments.ts
git commit -m "feat: add use-task-comments realtime hook"
```

---

### Task 4: TaskComments Component

**Files:**
- Create: `components/task-comments.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTaskComments } from '@/hooks/use-task-comments';
import { taskCommentSchema } from '@/lib/validation';
import { IconTrash } from '@/components/icons';
import type { TaskComment } from '@/types';

interface TaskCommentsProps {
  taskId: string;
  taskTitle: string;
  groupId: string;
  userId: string;
  userName: string;
  isLead: boolean;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = ['#1A56E8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function TaskComments({ taskId, taskTitle, groupId, userId, userName, isLead }: TaskCommentsProps) {
  const { comments, loading, error } = useTaskComments(taskId);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const deletingRef = useRef(false);

  async function handleSubmit() {
    if (saving) return;
    setFormError('');
    const parsed = taskCommentSchema.safeParse({ content });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);

    const { error: insertError } = await supabase.from('task_comments').insert({
      task_id: taskId,
      author_id: userId,
      content: parsed.data.content,
    });

    if (insertError) {
      setFormError('Failed to post comment. Please try again.');
      setSaving(false);
      return;
    }

    // Activity log
    supabase.from('activity_log').insert({
      group_id: groupId,
      actor_id: userId,
      action: 'comment_added',
      task_id: taskId,
      meta: { task_title: taskTitle, comment_preview: parsed.data.content.slice(0, 100) },
    }).then(null, () => {});

    // Telegram notification (fire-and-forget)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        message: `${userName} commented on "${taskTitle}": ${parsed.data.content.slice(0, 80)}`,
        type: 'contributions',
      }),
    }).catch(() => {});

    // In-app notification for assignee (fire-and-forget)
    supabase.from('tasks').select('assignee_id').eq('id', taskId).single().then(({ data: taskData }) => {
      if (taskData?.assignee_id && taskData.assignee_id !== userId) {
        supabase.from('notifications').insert({
          recipient_id: taskData.assignee_id,
          group_id: groupId,
          type: 'task_comment',
          title: `${userName} commented on "${taskTitle}"`,
          meta: { groupName: null, comment_preview: parsed.data.content.slice(0, 100) },
        }).then(null, () => {});
      }
    });

    setContent('');
    setSaving(false);
  }

  async function handleDelete(commentId: string) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    await supabase
      .from('task_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    deletingRef.current = false;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[13px] font-medium text-text-secondary">
          Discussion {comments.length > 0 && <span className="font-normal text-brand">({comments.length})</span>}
        </p>
      </div>

      {loading && <div className="py-4 flex justify-center"><div className="spinner" /></div>}

      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}

      {!loading && comments.length === 0 && (
        <p className="text-[12px] text-text-tertiary mb-3">No comments yet. Start the discussion.</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 mb-3 group">
          <div
            className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: getAvatarColor(c.author?.name ?? '') }}
          >
            {getInitials(c.author?.name ?? '??')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-text">{c.author?.name ?? 'Unknown'}</span>
              <span className="text-[11px] text-text-tertiary">{formatRelativeTime(c.created_at)}</span>
              {(c.author_id === userId || isLead) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity p-0.5"
                  aria-label="Delete comment"
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
            <p className="text-[13px] text-text mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
          </div>
        </div>
      ))}

      {/* Input */}
      <div className="flex gap-2 mt-2 items-end">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={1}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] text-text outline-none focus:border-brand resize-none"
          style={{ minHeight: '36px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="w-8 h-8 rounded-lg bg-brand hover:bg-brand-hover text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors"
          aria-label="Send comment"
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 14l12-6L2 2v5l8 1-8 1v5z" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>
      {formError && <p className="text-[11px] text-red-600 mt-1">{formError}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors (may need to verify `IconTrash` exists in `components/icons.tsx` — if not, use inline SVG)

- [ ] **Step 3: Commit**

```bash
git add components/task-comments.tsx
git commit -m "feat: add TaskComments component with list, input, and soft delete"
```

---

### Task 5: Integrate Into TaskModal

**Files:**
- Modify: `components/task-modal.tsx`

- [ ] **Step 1: Add import and render TaskComments**

Add import at the top of `task-modal.tsx`:

```typescript
import TaskComments from '@/components/task-comments';
```

Add the TaskComments component inside the modal, after the evidence section's closing `</div>` (after line 127) and before the closing `</div>` of the `p-5` container (line 128):

```typescript
          {/* Discussion */}
          <div>
            <TaskComments
              taskId={task.id}
              taskTitle={task.title}
              groupId={task.group_id}
              userId={userId}
              userName={members.find(m => m.profile_id === userId)?.profile?.name ?? 'You'}
              isLead={isLead}
            />
          </div>
```

- [ ] **Step 2: Verify build**

Run: `cd contrib && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add components/task-modal.tsx
git commit -m "feat: integrate task comments into TaskModal below evidence"
```

---

### Task 6: Notification Bell Icon + Changelog

**Files:**
- Modify: `components/notification-bell.tsx`
- Modify: `components/whats-new.tsx`

- [ ] **Step 1: Add task_comment icon to NotificationTypeIcon**

In `components/notification-bell.tsx`, add a new case before the `default` case in the `NotificationTypeIcon` switch:

```typescript
    case 'task_comment':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5H6l-3 2.5V12H3.5A1.5 1.5 0 012 10.5v-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
```

- [ ] **Step 2: Add changelog entry**

In `components/whats-new.tsx`, add a new entry at the top of the `CHANGELOG` array (before version 2):

```typescript
  {
    version: 3,
    date: '2026-04-01',
    items: [
      { title: 'Task comments', description: 'Discuss tasks with your group. Post comments, coordinate work, and keep the conversation in context.' },
    ],
  },
```

- [ ] **Step 3: Verify build**

Run: `cd contrib && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/notification-bell.tsx components/whats-new.tsx
git commit -m "feat: add task_comment notification icon and changelog entry"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Type check**

Run: `cd contrib && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full build**

Run: `cd contrib && npm run build`
Expected: Build succeeds with all pages listed

- [ ] **Step 3: Verify no console.error usage**

Run: `cd contrib && grep -r "console.error\|console.warn\|console.log" hooks/use-task-comments.ts components/task-comments.tsx`
Expected: No matches (all errors go through Sentry)

- [ ] **Step 4: Manual test checklist**

Run `npm run dev` and verify:
- Open a task in a group — comments section appears below evidence
- Post a comment — appears in realtime
- Delete own comment — disappears (soft delete)
- Group lead can delete any comment
- Non-author/non-lead does not see delete icon
- Empty state shows "No comments yet"
- Notification bell shows comment notifications with chat bubble icon
- Teacher drill-down does NOT show comments on tasks
