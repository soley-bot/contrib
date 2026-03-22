-- Migration: CRUD operations support
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- 1. Add soft-delete column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Update activity_log action constraint
--    Adds: task_updated (was missing), task_edited, task_deleted, task_reassigned,
--    group_updated, member_left, member_removed, lead_transferred
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_check
  CHECK (action IN (
    'task_created', 'task_assigned', 'task_updated', 'task_done', 'file_uploaded',
    'member_joined', 'task_edited', 'task_deleted', 'task_reassigned',
    'group_updated', 'member_left', 'member_removed', 'lead_transferred'
  ));

-- 3. Allow lead to delete their group (cascades to tasks, members, activity)
CREATE POLICY "Lead can delete group"
  ON public.groups FOR DELETE USING (auth.uid() = lead_id);

-- 4. Allow members to leave (delete own row) or lead to remove any member
CREATE POLICY "Members can leave or be removed by lead"
  ON public.group_members FOR DELETE USING (
    profile_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id AND lead_id = auth.uid()
    )
  );
