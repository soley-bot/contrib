-- 2026-04-19 — Evidence file upload
-- Adds four nullable columns to public.evidence for real file uploads.
-- Creates a private Storage bucket `evidence` and its RLS policies.
-- Purely additive. Legacy rows unaffected.

-- ── schema change ──────────────────────────────────────────────────────────
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS file_path  TEXT    NULL,
  ADD COLUMN IF NOT EXISTS file_name  TEXT    NULL,
  ADD COLUMN IF NOT EXISTS file_size  INTEGER NULL,
  ADD COLUMN IF NOT EXISTS mime_type  TEXT    NULL;

COMMENT ON COLUMN public.evidence.file_path IS
  'Storage object path when type = ''file'' and content was uploaded. NULL for legacy URL-based file evidence, link, and note.';

-- ── storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

-- ── storage RLS ────────────────────────────────────────────────────────────
-- Object key layout: {group_id}/{task_id}/{evidence_id}-{sanitized_filename}
-- storage.foldername(name)[1] returns the group_id (Postgres arrays are 1-indexed).

DROP POLICY IF EXISTS "evidence bucket insert by group member" ON storage.objects;
CREATE POLICY "evidence bucket insert by group member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(objects.name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "evidence bucket read by group member" ON storage.objects;
CREATE POLICY "evidence bucket read by group member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(objects.name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "evidence bucket read by course teacher" ON storage.objects;
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

-- No UPDATE or DELETE policies on storage.objects for the `evidence` bucket —
-- evidence is immutable (CLAUDE.md constraint #3).
