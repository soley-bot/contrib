-- ─────────────────────────────────────────────────────────────────────────────
-- Performance Indexes — Run in Supabase SQL Editor
-- These cover the most common query patterns in Contrib.
-- Last audited: 2026-04-02
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

-- courses: teacher_id lookups (teacher dashboard)
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id
  ON public.courses (teacher_id);

-- course_members: lookups by profile_id (student dashboard — course list)
-- Note: the unique index on (course_id, profile_id) has course_id as leading
-- column, so queries filtering only by profile_id cannot use it.
CREATE INDEX IF NOT EXISTS idx_course_members_profile_id
  ON public.course_members (profile_id);

-- notifications: recipient lookups (bell icon, every page load)
-- Composite index covers WHERE recipient_id = ? AND read_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications (recipient_id, read_at, created_at DESC);

-- telegram_subscriptions: profile lookups (notification sends)
-- Note: already covered by unique constraint on profile_id

-- evaluations: group_id lookups (peer review results, summaries view)
CREATE INDEX IF NOT EXISTS idx_evaluations_group_id
  ON public.evaluations (group_id);

-- blocker_declarations: group_id lookups (group page blockers section)
CREATE INDEX IF NOT EXISTS idx_blocker_declarations_group_id
  ON public.blocker_declarations (group_id);

-- blocker_declarations: profile_id lookups (user's blockers)
CREATE INDEX IF NOT EXISTS idx_blocker_declarations_profile_id
  ON public.blocker_declarations (profile_id);

-- task_comments: task_id lookups (task modal comment thread)
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
  ON public.task_comments (task_id);

-- telegram_subscriptions: chat_id lookups (webhook message routing)
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_chat_id
  ON public.telegram_subscriptions (chat_id);

-- report_shares: group_id lookups (check if share exists)
CREATE INDEX IF NOT EXISTS idx_report_shares_group_id
  ON public.report_shares (group_id);

-- report_shares: token lookups (public report page)
CREATE INDEX IF NOT EXISTS idx_report_shares_token
  ON public.report_shares (token);
