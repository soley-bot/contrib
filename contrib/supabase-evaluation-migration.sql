-- ── Peer Evaluation Migration ─────────────────────────────────────────────────
-- Run this in the Supabase SQL editor after supabase-migration.sql

-- 1. evaluation_sessions: one row per group when the lead opens evaluation
CREATE TABLE IF NOT EXISTS evaluation_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  opened_by  uuid REFERENCES profiles(id) NOT NULL,
  opened_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT evaluation_sessions_group_id_key UNIQUE (group_id)
);

ALTER TABLE evaluation_sessions ENABLE ROW LEVEL SECURITY;

-- Group members can see whether evaluation is open
CREATE POLICY "members_read_eval_session" ON evaluation_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = evaluation_sessions.group_id
        AND group_members.profile_id = auth.uid()
    )
  );

-- Only the group lead can open evaluation
CREATE POLICY "lead_insert_eval_session" ON evaluation_sessions
  FOR INSERT WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = evaluation_sessions.group_id
        AND groups.lead_id = auth.uid()
    )
  );

-- Teachers can read evaluation sessions for groups in their courses
CREATE POLICY "teacher_read_eval_session" ON evaluation_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = evaluation_sessions.group_id
        AND c.teacher_id = auth.uid()
    )
  );

-- 2. evaluations: one row per evaluator→evaluatee pair
CREATE TABLE IF NOT EXISTS evaluations (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id            uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  evaluator_id        uuid REFERENCES profiles(id) NOT NULL,
  evaluatee_id        uuid REFERENCES profiles(id) NOT NULL,
  contribution_score  int  NOT NULL CHECK (contribution_score BETWEEN 1 AND 5),
  collaboration_score int  NOT NULL CHECK (collaboration_score BETWEEN 1 AND 5),
  comment             text,
  submitted_at        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT evaluations_unique_pair UNIQUE (group_id, evaluator_id, evaluatee_id),
  CONSTRAINT evaluations_no_self_eval CHECK (evaluator_id <> evaluatee_id)
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Evaluators can read their own submitted rows (to confirm submission)
CREATE POLICY "evaluator_read_own" ON evaluations
  FOR SELECT USING (evaluator_id = auth.uid());

-- Teachers can read all evaluations for groups in their courses
CREATE POLICY "teacher_read_course_evals" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = evaluations.group_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Group members can submit evaluations when a session is open
CREATE POLICY "member_insert_eval" ON evaluations
  FOR INSERT WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = evaluations.group_id
        AND group_members.profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM evaluation_sessions
      WHERE evaluation_sessions.group_id = evaluations.group_id
    )
  );

-- 3. Aggregated summary view (strips evaluator_id for anonymity)
CREATE OR REPLACE VIEW evaluation_summaries AS
SELECT
  group_id,
  evaluatee_id,
  ROUND(AVG(contribution_score)::numeric, 1)  AS avg_contribution,
  ROUND(AVG(collaboration_score)::numeric, 1) AS avg_collaboration,
  COUNT(*)::int                               AS eval_count,
  array_agg(comment) FILTER (WHERE comment IS NOT NULL AND comment <> '') AS comments
FROM evaluations
GROUP BY group_id, evaluatee_id;

-- Grant view access to authenticated users
GRANT SELECT ON evaluation_summaries TO authenticated;

-- 4. Expand activity_log action check constraint to include evaluation actions
ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_action_check CHECK (
    action IN (
      'task_created', 'task_assigned', 'task_updated', 'task_done',
      'file_uploaded', 'evidence_added', 'evidence_version_added',
      'member_joined', 'task_edited', 'task_deleted', 'task_reassigned',
      'group_updated', 'member_left', 'member_removed', 'lead_transferred',
      'evaluation_opened', 'evaluation_submitted'
    )
  );
