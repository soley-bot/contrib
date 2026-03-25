-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Audit Fix — Run in Supabase SQL Editor after all previous migrations
-- Addresses gaps found during launch hardening audit.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Teachers can read evidence for tasks in their courses ─────────────────
-- Currently teachers can read tasks but NOT evidence. This blocks the
-- teacher group drill-down from showing evidence counts and details.
DROP POLICY IF EXISTS "Teachers can read evidence in their courses" ON public.evidence;

CREATE POLICY "Teachers can read evidence in their courses"
  ON public.evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.groups g ON g.id = t.group_id
      JOIN public.courses c ON c.id = g.course_id
      WHERE t.id = evidence.task_id
        AND c.teacher_id = auth.uid()
    )
  );

-- ── 2. Lead can remove group members ─────────────────────────────────────────
-- Members can join (INSERT policy exists), but there's no DELETE policy
-- for the lead to remove members. Without this, the "Remove member" button
-- silently fails via RLS.
DROP POLICY IF EXISTS "Lead can remove group members" ON public.group_members;

CREATE POLICY "Lead can remove group members"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
        AND groups.lead_id = auth.uid()
    )
  );

-- ── 3. Members can leave groups (delete own membership) ──────────────────────
DROP POLICY IF EXISTS "Members can leave groups" ON public.group_members;

CREATE POLICY "Members can leave groups"
  ON public.group_members FOR DELETE
  USING (profile_id = auth.uid());

-- ── 4. Lead can delete evaluations when resetting peer review ────────────────
-- The resetEvaluation function deletes evaluations and the session.
-- Without a DELETE policy, this fails via RLS.
DROP POLICY IF EXISTS "Lead can delete evaluations" ON public.evaluations;

CREATE POLICY "Lead can delete evaluations"
  ON public.evaluations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = evaluations.group_id
        AND groups.lead_id = auth.uid()
    )
  );

-- ── 5. Lead can delete evaluation session ────────────────────────────────────
DROP POLICY IF EXISTS "Lead can delete eval session" ON public.evaluation_sessions;

CREATE POLICY "Lead can delete eval session"
  ON public.evaluation_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = evaluation_sessions.group_id
        AND groups.lead_id = auth.uid()
    )
  );

-- ── 6. Lead can delete own group ─────────────────────────────────────────────
-- The "Lead can update group" policy exists, but no DELETE policy for
-- the lead (only teacher course deletion exists). Without this, the
-- "Delete group" button on the student side fails.
DROP POLICY IF EXISTS "Lead can delete own group" ON public.groups;

CREATE POLICY "Lead can delete own group"
  ON public.groups FOR DELETE
  USING (lead_id = auth.uid());

-- ── VERIFICATION QUERIES ─────────────────────────────────────────────────────
-- Run these after applying to confirm RLS is enabled on all tables:
--
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
--
-- List all policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, cmd;
