-- Phase 1 Migration: Blocker Declarations + Contribution Types + Telegram Subscriptions
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Apply all three sections together — they are designed as one atomic schema change.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONTRIBUTION TYPES
--    Add contribution_type to tasks so students can categorize their work
--    beyond just "task". New types: coordination, meeting, discussion, research.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contribution_type text NOT NULL DEFAULT 'task'
  CHECK (contribution_type IN ('task', 'coordination', 'meeting', 'discussion', 'research'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BLOCKER DECLARATIONS
--    Students self-declare when they can't contribute (family, work, exams).
--    Logged in the group timeline. Separates free riders (0 contributions,
--    0 declarations) from students with legitimate reasons.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocker_declarations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocker_declarations ENABLE ROW LEVEL SECURITY;

-- Group members can read declarations in their group
CREATE POLICY "Group members can view blocker declarations"
  ON public.blocker_declarations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = blocker_declarations.group_id
        AND gm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = blocker_declarations.group_id
        AND g.lead_id = auth.uid()
    )
  );

-- Students can only declare their own blockers
CREATE POLICY "Students can declare their own blockers"
  ON public.blocker_declarations FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Teachers can view declarations for groups in their courses
CREATE POLICY "Teachers can view blocker declarations for their course groups"
  ON public.blocker_declarations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.courses c ON g.course_id = c.id
      WHERE g.id = blocker_declarations.group_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Index for fast lookup by group
CREATE INDEX IF NOT EXISTS idx_blocker_declarations_group_id
  ON public.blocker_declarations (group_id);

-- Index for fast lookup by profile
CREATE INDEX IF NOT EXISTS idx_blocker_declarations_profile_id
  ON public.blocker_declarations (profile_id);

-- Add blocker_declared to the activity_log action constraint
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_check
  CHECK (action IN (
    'task_created', 'task_assigned', 'task_updated', 'task_done', 'file_uploaded',
    'evidence_added', 'evidence_version_added',
    'member_joined', 'task_edited', 'task_deleted', 'task_reassigned',
    'group_updated', 'member_left', 'member_removed', 'lead_transferred',
    'evaluation_opened', 'evaluation_submitted',
    'blocker_declared'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TELEGRAM SUBSCRIPTIONS
--    Maps a user to their Telegram chat_id after they verify via the bot.
--    Stores per-user notification preferences.
--    One record per user (unique on profile_id).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.telegram_subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id                 bigint      NOT NULL,
  verified                boolean     NOT NULL DEFAULT false,
  verification_code       text,
  verification_expires_at timestamptz,
  -- Notification preferences (all on by default)
  notify_contributions    boolean     NOT NULL DEFAULT true,
  notify_blockers         boolean     NOT NULL DEFAULT true,
  notify_deadlines        boolean     NOT NULL DEFAULT true,
  notify_weekly_digest    boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own subscription
CREATE POLICY "Users can view their own telegram subscription"
  ON public.telegram_subscriptions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own telegram subscription"
  ON public.telegram_subscriptions FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own telegram subscription"
  ON public.telegram_subscriptions FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own telegram subscription"
  ON public.telegram_subscriptions FOR DELETE
  USING (profile_id = auth.uid());

-- Index for fast chat_id lookup (used when sending notifications)
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_chat_id
  ON public.telegram_subscriptions (chat_id);
