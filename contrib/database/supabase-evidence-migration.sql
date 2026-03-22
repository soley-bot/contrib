-- Evidence table migration
-- Run this in the Supabase SQL editor

CREATE TABLE evidence (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by    UUID        NOT NULL REFERENCES profiles(id),
  type           TEXT        NOT NULL CHECK (type IN ('file', 'link', 'note')),
  content        TEXT        NOT NULL,
  version_number INTEGER     NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_task_id_fkey         FOREIGN KEY (task_id)     REFERENCES tasks(id)    ON DELETE CASCADE,
  CONSTRAINT evidence_uploaded_by_fkey     FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Group members can view evidence for tasks in their groups
CREATE POLICY "Group members can view evidence"
  ON evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = evidence.task_id
        AND gm.profile_id = auth.uid()
    )
  );

-- Authenticated users can insert their own evidence
CREATE POLICY "Users can insert own evidence"
  ON evidence FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- NO DELETE policy — evidence is a permanent record
