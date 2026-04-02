-- RLS Security Hardening Migration
-- Date: 2026-04-02
--
-- Bug 1: notifications INSERT policy was too permissive.
--   Any authenticated user could insert a notification to any recipient.
--   Fix: Drop the INSERT policy. Inserts now only work via adminClient (service role),
--   which bypasses RLS.
--
-- Bug 2: tasks SELECT policies did not filter soft-deleted rows.
--   A client could query tasks where deleted_at IS NOT NULL.
--   Fix: Add "deleted_at IS NULL" to all SELECT policies on tasks.

-- ============================================================
-- Bug 1: Drop overly permissive notifications INSERT policy
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users create notifications" ON notifications;

-- ============================================================
-- Bug 2: Harden tasks SELECT policies to exclude soft-deleted
-- ============================================================

-- Recreate: Group members can read tasks (with soft-delete filter)
DROP POLICY IF EXISTS "Group members can read tasks" ON tasks;
CREATE POLICY "Group members can read tasks" ON tasks
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id
        AND group_members.profile_id = auth.uid()
    )
  );

-- Recreate: Teachers can read tasks in their courses (with soft-delete filter)
DROP POLICY IF EXISTS "Teachers can read tasks in their courses" ON tasks;
CREATE POLICY "Teachers can read tasks in their courses" ON tasks
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = tasks.group_id
        AND c.teacher_id = auth.uid()
    )
  );
