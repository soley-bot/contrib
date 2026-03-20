-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Infinite Recursion + Teacher Access Fix
-- Run this in the Supabase SQL Editor AFTER the security migration.
--
-- Root cause: The security migration added "Members can read own groups" on
-- the groups table, which queries group_members. The "Teachers can read
-- group_members in their courses" policy on group_members queries groups.
-- This creates an infinite cycle:
--   groups RLS → group_members table → group_members RLS → groups table → loop
--
-- Secondary issue: Teachers cannot read groups in their courses because the
-- new policy only allows members/leads, not the course teacher.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. SECURITY DEFINER helper function
--    Queries group_members directly, bypassing RLS.
--    This is the key that breaks the recursion cycle.
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

-- 2. Replace the groups SELECT policy.
--    Old policy queried group_members WITH RLS → cycle.
--    New policy uses the SECURITY DEFINER function → no cycle.
--    Also adds teacher course ownership check (was missing entirely).
DROP POLICY IF EXISTS "Members can read own groups" ON public.groups;

CREATE POLICY "Members and teachers can read groups"
  ON public.groups FOR SELECT
  USING (
    lead_id = auth.uid()
    OR user_is_group_member(groups.id)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = groups.course_id AND c.teacher_id = auth.uid()
    )
  );

-- 3. Fix the self-referential "Members can read group_members" policy.
--    The original policy had an EXISTS subquery against group_members itself,
--    which can also trigger infinite recursion. Replace with the SECURITY
--    DEFINER function.
DROP POLICY IF EXISTS "Members can read group_members" ON public.group_members;

CREATE POLICY "Members can read group_members"
  ON public.group_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR user_is_group_member(group_members.group_id)
  );

-- 4. Add missing DELETE policies for teacher course/group management.
DROP POLICY IF EXISTS "Teacher can delete own course" ON public.courses;

CREATE POLICY "Teacher can delete own course"
  ON public.courses FOR DELETE
  USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teacher can delete groups in their courses" ON public.groups;

CREATE POLICY "Teacher can delete groups in their courses"
  ON public.groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = groups.course_id AND c.teacher_id = auth.uid()
    )
  );

-- 5. Add missing UPDATE policy on courses for teacher to edit name/subject.
DROP POLICY IF EXISTS "Teacher can update own course" ON public.courses;

CREATE POLICY "Teacher can update own course"
  ON public.courses FOR UPDATE
  USING (auth.uid() = teacher_id);
