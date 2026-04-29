-- 2026-04-30 - Atomic evidence versioning
-- Ensures each task receives unique, sequential evidence version numbers under
-- concurrent submissions.

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_task_version_unique
  ON public.evidence (task_id, version_number);

CREATE OR REPLACE FUNCTION public.create_evidence_with_next_version(
  p_id uuid,
  p_task_id uuid,
  p_uploaded_by uuid,
  p_type text,
  p_content text,
  p_file_path text DEFAULT NULL,
  p_file_name text DEFAULT NULL,
  p_file_size integer DEFAULT NULL,
  p_mime_type text DEFAULT NULL
)
RETURNS public.evidence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence public.evidence;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_task_id::text, 0));

  INSERT INTO public.evidence (
    id,
    task_id,
    uploaded_by,
    type,
    content,
    version_number,
    file_path,
    file_name,
    file_size,
    mime_type
  )
  VALUES (
    p_id,
    p_task_id,
    p_uploaded_by,
    p_type,
    p_content,
    (
      SELECT COALESCE(MAX(version_number), 0) + 1
      FROM public.evidence
      WHERE task_id = p_task_id
    ),
    p_file_path,
    p_file_name,
    p_file_size,
    p_mime_type
  )
  RETURNING * INTO v_evidence;

  RETURN v_evidence;
END;
$$;
