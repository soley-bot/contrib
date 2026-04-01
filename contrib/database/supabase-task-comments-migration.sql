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
