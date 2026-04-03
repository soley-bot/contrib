-- Migration: Tighten profiles SELECT and courses SELECT RLS policies
-- Date: 2026-04-03
-- Context: Pre-launch security hardening. profiles was readable by all authenticated users,
--          courses SELECT exposed invite_token to all authenticated users.

-- ── profiles: restrict to own profile, group co-members, course co-members, and teachers ──

DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;

CREATE POLICY "Users can read relevant profiles"
  ON public.profiles FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.profile_id = auth.uid() AND gm2.profile_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.course_members cm1
      JOIN public.course_members cm2 ON cm1.course_id = cm2.course_id
      WHERE cm1.profile_id = auth.uid() AND cm2.profile_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.course_members cm ON cm.course_id = c.id
      WHERE c.teacher_id = profiles.id AND cm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.course_members cm ON cm.course_id = c.id
      WHERE c.teacher_id = auth.uid() AND cm.profile_id = profiles.id
    )
  );

-- ── courses: restrict to teacher owner + enrolled members ──

DROP POLICY IF EXISTS "Authenticated users can read courses" ON public.courses;

CREATE POLICY "Course teacher and members can read courses"
  ON public.courses FOR SELECT USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.course_members
      WHERE course_members.course_id = courses.id AND course_members.profile_id = auth.uid()
    )
  );
