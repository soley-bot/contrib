-- Security migration — run this in the Supabase SQL Editor
-- Fixes three RLS/view vulnerabilities found in the security audit.

-- ─────────────────────────────────────────────────────────────
-- 1. Groups SELECT policy: was `using (true)` (any user could
--    read ALL groups and their invite tokens). Replace with a
--    member/lead-only policy. Token-based lookups now go through
--    /api/join/lookup (server-side, service role) instead of
--    direct client queries.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read group by invite token" ON public.groups;

CREATE POLICY "Members can read own groups"
  ON public.groups FOR SELECT
  USING (
    lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id AND gm.profile_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Evidence INSERT policy: was only checking uploaded_by = me.
--    Now also requires the user to be a member of the group that
--    owns the task.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own evidence" ON public.evidence;

CREATE POLICY "Group members can insert evidence"
  ON public.evidence FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE t.id = evidence.task_id
        AND gm.profile_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. evaluation_summaries view: PostgreSQL views bypass RLS on
--    their base tables unless security_invoker = true is set.
--    Adding it forces the view to run as the calling user,
--    inheriting the RLS policies on the evaluations table.
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS evaluation_summaries;

CREATE OR REPLACE VIEW evaluation_summaries
  WITH (security_invoker = true)
AS
SELECT
  group_id,
  evaluatee_id,
  ROUND(AVG(contribution_score)::numeric, 1)  AS avg_contribution,
  ROUND(AVG(collaboration_score)::numeric, 1) AS avg_collaboration,
  COUNT(*)::int                               AS eval_count,
  array_agg(comment) FILTER (WHERE comment IS NOT NULL AND comment <> '') AS comments
FROM public.evaluations
GROUP BY group_id, evaluatee_id;

GRANT SELECT ON evaluation_summaries TO authenticated;
