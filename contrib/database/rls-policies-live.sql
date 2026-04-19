-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Canonical Live State
-- Last verified: 2026-04-03
--
-- THIS FILE IS THE SINGLE SOURCE OF TRUTH for what RLS policies exist in
-- production. Every policy change MUST be reflected here. If this file
-- disagrees with the live DB, this file is wrong — query pg_policies.
--
-- To re-apply from scratch (nuclear option):
--   1. Drop all policies on all tables
--   2. Run this file top to bottom
--
-- Helper function (SECURITY DEFINER — bypasses RLS to break recursion):
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND profile_id = auth.uid()
  );
$$;

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

-- ── profiles ─────────────────────────────────────────────────────────────────

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

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ── courses ──────────────────────────────────────────────────────────────────

CREATE POLICY "Course teacher and members can read courses"
  ON public.courses FOR SELECT USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.course_members
      WHERE course_members.course_id = courses.id AND course_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert their courses"
  ON public.courses FOR INSERT WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Teacher can update own course"
  ON public.courses FOR UPDATE USING (auth.uid() = teacher_id);

-- ── course_members ───────────────────────────────────────────────────────────

CREATE POLICY "Teachers can read course members"
  ON public.course_members FOR SELECT USING (
    user_is_course_teacher(course_members.course_id)
  );

CREATE POLICY "Users can read own memberships"
  ON public.course_members FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Authenticated users can join courses"
  ON public.course_members FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Members can leave courses"
  ON public.course_members FOR DELETE USING (auth.uid() = profile_id);

-- ── groups ────────────────────────────────────────────────────────────────────

CREATE POLICY "Members and teachers can read groups"
  ON public.groups FOR SELECT USING (
    archived_at IS NULL
    AND (
      lead_id = auth.uid()
      OR user_is_group_member(groups.id)
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = groups.course_id AND c.teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can insert groups"
  ON public.groups FOR INSERT WITH CHECK (auth.uid() = lead_id);

CREATE POLICY "Lead can update group"
  ON public.groups FOR UPDATE USING (auth.uid() = lead_id);

CREATE POLICY "Lead can link group to course"
  ON public.groups FOR UPDATE USING (auth.uid() = lead_id);

CREATE POLICY "Lead can delete group"
  ON public.groups FOR DELETE USING (auth.uid() = lead_id);

-- ── group_members ────────────────────────────────────────────────────────────

CREATE POLICY "Members and teachers can read group_members"
  ON public.group_members FOR SELECT USING (
    profile_id = auth.uid()
    OR user_is_group_member(group_members.group_id)
    OR EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.courses c ON c.id = g.course_id
      WHERE g.id = group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can join groups"
  ON public.group_members FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Members can leave or be removed by lead"
  ON public.group_members FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id AND groups.lead_id = auth.uid()
    )
  );

-- ── tasks ─────────────────────────────────────────────────────────────────────

CREATE POLICY "Group members can read tasks"
  ON public.tasks FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id AND group_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can read tasks in their courses"
  ON public.tasks FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = tasks.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert tasks"
  ON public.tasks FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id AND group_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Assignee and lead can update tasks"
  ON public.tasks FOR UPDATE USING (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups WHERE groups.id = tasks.group_id AND groups.lead_id = auth.uid()
    )
  );

-- ── evidence ──────────────────────────────────────────────────────────────────

CREATE POLICY "Group members can view evidence"
  ON public.evidence FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = evidence.task_id AND gm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can read evidence in their courses"
  ON public.evidence FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN groups g ON g.id = t.group_id
      JOIN courses c ON c.id = g.course_id
      WHERE t.id = evidence.task_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert evidence"
  ON public.evidence FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = evidence.task_id AND gm.profile_id = auth.uid()
    )
  );

-- ── task_comments ─────────────────────────────────────────────────────────────

CREATE POLICY "Members and teachers can read comments"
  ON public.task_comments FOR SELECT USING (
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

CREATE POLICY "Users can insert own comments"
  ON public.task_comments FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can soft-delete own comments"
  ON public.task_comments FOR UPDATE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM tasks t
      JOIN groups g ON g.id = t.group_id
      WHERE t.id = task_comments.task_id AND g.lead_id = auth.uid()
    )
  );

-- ── activity_log ──────────────────────────────────────────────────────────────

CREATE POLICY "Group members can read activity"
  ON public.activity_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = activity_log.group_id AND group_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can read activity in their courses"
  ON public.activity_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = activity_log.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert activity"
  ON public.activity_log FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = activity_log.group_id AND group_members.profile_id = auth.uid()
    )
  );

-- ── evaluation_sessions ───────────────────────────────────────────────────────

CREATE POLICY "members_read_eval_session"
  ON public.evaluation_sessions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = evaluation_sessions.group_id AND group_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "teacher_read_eval_session"
  ON public.evaluation_sessions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = evaluation_sessions.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "lead_insert_eval_session"
  ON public.evaluation_sessions FOR INSERT WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM groups WHERE groups.id = evaluation_sessions.group_id AND groups.lead_id = auth.uid()
    )
  );

CREATE POLICY "Lead can delete eval session"
  ON public.evaluation_sessions FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups WHERE groups.id = evaluation_sessions.group_id AND groups.lead_id = auth.uid()
    )
  );

-- ── evaluations ───────────────────────────────────────────────────────────────

CREATE POLICY "evaluator_read_own"
  ON public.evaluations FOR SELECT USING (evaluator_id = auth.uid());

CREATE POLICY "teacher_read_course_evals"
  ON public.evaluations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON c.id = g.course_id
      WHERE g.id = evaluations.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "member_insert_eval"
  ON public.evaluations FOR INSERT WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = evaluations.group_id AND group_members.profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM evaluation_sessions
      WHERE evaluation_sessions.group_id = evaluations.group_id
    )
  );

CREATE POLICY "Lead can delete evaluations"
  ON public.evaluations FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups WHERE groups.id = evaluations.group_id AND groups.lead_id = auth.uid()
    )
  );

-- ── blocker_declarations ──────────────────────────────────────────────────────

CREATE POLICY "Group members can view blocker declarations"
  ON public.blocker_declarations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = blocker_declarations.group_id AND gm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM groups g WHERE g.id = blocker_declarations.group_id AND g.lead_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view blocker declarations for their course groups"
  ON public.blocker_declarations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN courses c ON g.course_id = c.id
      WHERE g.id = blocker_declarations.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can declare their own blockers"
  ON public.blocker_declarations FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ── report_shares ─────────────────────────────────────────────────────────────

CREATE POLICY "Group members can read report shares"
  ON public.report_shares FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE profile_id = auth.uid())
  );

CREATE POLICY "Group lead can create report shares"
  ON public.report_shares FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND group_id IN (SELECT id FROM groups WHERE lead_id = auth.uid())
  );

CREATE POLICY "Group lead can delete report shares"
  ON public.report_shares FOR DELETE USING (
    group_id IN (SELECT id FROM groups WHERE lead_id = auth.uid())
  );

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Users mark own as read"
  ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- ── telegram_subscriptions ────────────────────────────────────────────────────

CREATE POLICY "Users can view their own telegram subscription"
  ON public.telegram_subscriptions FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own telegram subscription"
  ON public.telegram_subscriptions FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own telegram subscription"
  ON public.telegram_subscriptions FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own telegram subscription"
  ON public.telegram_subscriptions FOR DELETE USING (profile_id = auth.uid());

-- ── storage: evidence bucket (added 2026-04-19) ────────────────────────────

-- Bucket: public.storage.buckets row with id='evidence', public=false.

-- INSERT: authenticated group member of the task's group
CREATE POLICY "evidence bucket insert by group member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(objects.name))[1])::uuid
    )
  );

-- SELECT 1: group members can read files attached to tasks in their group
CREATE POLICY "evidence bucket read by group member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(objects.name))[1])::uuid
    )
  );

-- SELECT 2: course teacher can read files for groups in their course
CREATE POLICY "evidence bucket read by course teacher"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND EXISTS (
      SELECT 1
      FROM public.groups g
      JOIN public.courses c ON c.id = g.course_id
      WHERE g.id = ((storage.foldername(objects.name))[1])::uuid
        AND c.teacher_id = auth.uid()
    )
  );
