# Task Comments — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Approach:** Simple flat comments (no threading)

## Overview

Add a discussion thread to each task where group members can post comments, visible below evidence in the TaskModal. Comments are student-only — teachers do not see them in the drill-down view.

## Data Model

### New table: `task_comments`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| task_id | uuid | NOT NULL, REFERENCES tasks(id) ON DELETE CASCADE |
| author_id | uuid | NOT NULL, REFERENCES profiles(id) |
| content | text | NOT NULL, max 2000 chars (validated via Zod) |
| deleted_at | timestamptz | NULL (soft delete) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### RLS Policies

- **SELECT:** Group members can read comments where `deleted_at IS NULL` (join through tasks → group_members)
- **INSERT:** Users can insert where `author_id = auth.uid()`
- **UPDATE:** Users can soft-delete own comments where `author_id = auth.uid()` (only `deleted_at` column)

### Index

- `idx_task_comments_task_id ON task_comments(task_id)`

### Activity Log

Add `comment_added` to the `activity_log` action CHECK constraint.

### New type in `types/index.ts`

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

### Notification type

Add `task_comment` to the `NotificationType` union in `types/index.ts`.

## New Files

### 1. `database/supabase-task-comments-migration.sql`

- CREATE TABLE `task_comments`
- RLS policies (SELECT, INSERT, UPDATE)
- Index on `task_id`
- Update `activity_log` action CHECK constraint to include `comment_added`

### 2. `hooks/use-task-comments.ts`

Follows the `use-evidence.ts` pattern exactly:

- Accepts `taskId: string | undefined`
- Fetches comments with `author:profiles(*)` join, ordered by `created_at ASC`
- Filters `deleted_at IS NULL`
- Realtime subscription on `task_comments` table filtered by `task_id`
- `mountedRef` guard on all setState calls
- Sentry on errors
- Returns `{ comments, loading, error, refresh }`

### 3. `components/task-comments.tsx`

Single component containing the comment list and input form:

**Comment list:**
- Avatar initials (first two letters of author name, colored by hash)
- Author name + relative timestamp
- Comment content (plain text)
- Soft-deleted comments show "[Comment removed]" in italic gray
- Delete icon (trash) on hover — visible only to comment author and group lead
- Double-submit guard on delete via ref

**Input form:**
- Text input with placeholder "Add a comment..."
- Send button (brand blue, SVG arrow icon)
- Enter key submits, Shift+Enter for newline (textarea, not input)
- Zod validation: 1-2000 chars, trimmed
- Double-submit guard via `saving` state + `if (saving) return`
- On submit:
  1. Insert into `task_comments` (client-side supabase, RLS enforced)
  2. Insert `activity_log` entry: action `comment_added`, meta `{ task_title, comment_preview: content.slice(0, 100) }`
  3. Fire-and-forget: POST `/api/notify` with type `contributions`, message `"[Name] commented on [Task Title]: [first 80 chars]"`
  4. Insert in-app notification for task assignee (if different from commenter), type `task_comment`
  5. Clear input

### 4. `lib/validation.ts` (update)

Add Zod schema:
```typescript
export const taskCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty.').max(2000, 'Comment is too long (max 2000 characters).'),
});
```

## Modified Files

### 1. `components/task-modal.tsx`

Add `TaskComments` component below the evidence section. Pass `taskId`, `groupId`, `userId`, and `isLead`. Only render when task is defined.

### 2. `types/index.ts`

Add `TaskComment` interface and `task_comment` to `NotificationType`.

### 3. `components/notification-bell.tsx`

Add `task_comment` case to `NotificationTypeIcon` switch — use a chat bubble SVG icon.

### 4. `components/whats-new.tsx`

Add changelog entry: "Task Comments — Discuss tasks with your group. Post comments, coordinate work, and keep the conversation in context."

## Behavior

### Posting
1. User types comment, clicks send or presses Enter
2. Zod validates content (1-2000 chars)
3. Client-side insert into `task_comments` (RLS enforces group membership)
4. Activity log entry created
5. Telegram notification sent to group (excludes commenter)
6. In-app notification sent to task assignee (if different from commenter)
7. Realtime subscription updates all members viewing the task

### Soft Delete
1. Author sees trash icon on hover (group lead sees it on all comments)
2. Click sets `deleted_at = now()` via supabase update
3. Comment renders as "[Comment removed]" in italic gray text
4. No activity log entry for deletion
5. Realtime subscription updates all viewers

### Teacher View
Teachers do NOT see comments in the group drill-down. The `TaskComments` component is not rendered in `teacher/course/[id]/group/[groupId].tsx`. Comments are a student collaboration space.

## Not In Scope

- Threading / replies
- @mentions
- Comment editing (immutable — post new comment instead)
- File attachments in comments (use evidence for that)
- Comment reactions / emoji
