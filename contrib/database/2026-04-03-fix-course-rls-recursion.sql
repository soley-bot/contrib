-- Fix: infinite recursion between courses and course_members RLS policies
--
-- The course_members "Teachers can read" policy queries courses,
-- and the courses "members can read" policy queries course_members,
-- creating an infinite loop. Fix: SECURITY DEFINER function bypasses
-- courses RLS, breaking the cycle (same pattern as user_is_group_member).

-- Step 1: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_course_teacher(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = p_course_id AND teacher_id = auth.uid()
  );
$$;

-- Step 2: Replace the recursive policy on course_members
DROP POLICY IF EXISTS "Teachers can read course members" ON public.course_members;
CREATE POLICY "Teachers can read course members"
  ON public.course_members FOR SELECT USING (
    user_is_course_teacher(course_members.course_id)
  );
