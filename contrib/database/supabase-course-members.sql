-- Track students enrolled in a course (before they join a group)
CREATE TABLE IF NOT EXISTS course_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, profile_id)
);

ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;

-- Teachers can see members of their courses
CREATE POLICY "Teachers can read course members"
  ON course_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = course_members.course_id AND courses.teacher_id = auth.uid())
  );

-- Users can read their own course memberships
CREATE POLICY "Users can read own memberships"
  ON course_members FOR SELECT
  USING (auth.uid() = profile_id);

-- Authenticated users can join courses (via invite link)
CREATE POLICY "Authenticated users can join courses"
  ON course_members FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Members can leave courses
CREATE POLICY "Members can leave courses"
  ON course_members FOR DELETE
  USING (auth.uid() = profile_id);
