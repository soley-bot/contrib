-- Add archived_at column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
