-- ─────────────────────────────────────────────────────────────────────────────
-- Performance Indexes — Run in Supabase SQL Editor
-- These cover the most common query patterns in Contrib.
-- ─────────────────────────────────────────────────────────────────────────────

-- tasks: fetched by group_id, filtered by deleted_at IS NULL (every page load)
CREATE INDEX IF NOT EXISTS idx_tasks_group_id_active
  ON public.tasks (group_id)
  WHERE deleted_at IS NULL;

-- tasks: assignee lookups (profile page stats, peer review)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id
  ON public.tasks (assignee_id)
  WHERE deleted_at IS NULL;

-- evidence: fetched by task_id, ordered by version_number (evidence list)
CREATE INDEX IF NOT EXISTS idx_evidence_task_id_version
  ON public.evidence (task_id, version_number DESC);

-- activity_log: fetched by group_id, ordered by created_at (timeline tab)
CREATE INDEX IF NOT EXISTS idx_activity_log_group_id_created
  ON public.activity_log (group_id, created_at DESC);

-- group_members: lookups by group_id (membership checks, member lists)
CREATE INDEX IF NOT EXISTS idx_group_members_group_id
  ON public.group_members (group_id);

-- group_members: lookups by profile_id (user's groups list)
CREATE INDEX IF NOT EXISTS idx_group_members_profile_id
  ON public.group_members (profile_id);

-- groups: lookups by course_id (teacher course detail page)
CREATE INDEX IF NOT EXISTS idx_groups_course_id
  ON public.groups (course_id)
  WHERE course_id IS NOT NULL;

-- groups: invite token lookups (join page)
-- Note: invite_token already has a UNIQUE constraint which creates an index,
-- but adding explicitly for clarity.
-- CREATE INDEX IF NOT EXISTS idx_groups_invite_token ON public.groups (invite_token);

-- courses: teacher_id lookups (teacher dashboard)
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id
  ON public.courses (teacher_id);

-- evaluations: group_id lookups (peer review results, summaries view)
CREATE INDEX IF NOT EXISTS idx_evaluations_group_id
  ON public.evaluations (group_id);

-- evaluation_sessions: group_id lookups (check if eval is open)
-- Note: group_id already has a UNIQUE constraint on evaluation_sessions.
-- No additional index needed.
