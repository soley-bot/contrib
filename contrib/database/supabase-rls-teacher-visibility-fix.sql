-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Teacher Visibility Fix
-- Applied: 2026-04-02
--
-- Problem: After auto-transfer removes a teacher from group_members, the
-- teacher loses visibility into group_members (and task_comments) because
-- the SELECT policies only checked group membership, not course ownership.
--
-- Fix: Consolidate group_members SELECT into a single policy with three
-- conditions (own record, fellow member, or course teacher). Add teacher
-- course check to task_comments SELECT policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Ensure user_is_group_member function exists (SECURITY DEFINER, breaks
--    RLS recursion by querying group_members directly).
CREATE OR REPLACE FUNCTION public.user_is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND profile_id = auth.uid()
  );
$$;

-- 1. Unified group_members SELECT policy
--    Replaces both "Members can read group_members" and
--    "Teachers can read group_members in their courses" with a single policy.
DROP POLICY IF EXISTS "Members can read group_members" ON public.group_members;
DROP POLICY IF EXISTS "Members and teachers can read group_members" ON public.group_members;
DROP POLICY IF EXISTS "Teachers can read group_members in their courses" ON public.group_members;

CREATE POLICY "Members and teachers can read group_members"
  ON public.group_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR auth_is_group_member(group_members.group_id)
    OR EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.courses c ON c.id = g.course_id
      WHERE g.id = group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

-- 2. Add teacher visibility to task_comments SELECT policy
--    Previously only group members could read comments; teachers in the
--    course could not.
DROP POLICY IF EXISTS "Group members can read comments" ON public.task_comments;
DROP POLICY IF EXISTS "Members and teachers can read comments" ON public.task_comments;

CREATE POLICY "Members and teachers can read comments"
  ON public.task_comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM tasks t
        JOIN group_members gm ON gm.group_id = t.group_id
        WHERE t.id = task_comments.task_id AND gm.profile_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tasks t
        JOIN groups g ON g.id = t.group_id
        JOIN courses c ON c.id = g.course_id
        WHERE t.id = task_comments.task_id AND c.teacher_id = auth.uid()
      )
    )
  );

-- Note: evidence and blocker_declarations already had teacher course policies:
--   "Teachers can read evidence in their courses"
--   "Teachers can view blocker declarations for their course groups"
-- No changes needed for those tables.
