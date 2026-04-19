import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import formidable, { type Fields as FormidableFields, type Files as FormidableFiles } from 'formidable';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, createEvidenceApiSchema } from '@/lib/validation';
import {
  sanitizeFilename,
  buildObjectKey,
  MAX_FILE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/evidence-upload';

// Disable Next's default body parser so formidable can read the raw stream.
export const config = { api: { bodyParser: false } };

interface ParsedField { [key: string]: string }
interface ParsedFile {
  filepath: string;
  originalFilename: string | null;
  mimetype: string | null;
  size: number;
}

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`evidence-create:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  // Parse multipart body.
  const fields: ParsedField = {};
  let uploadedFile: ParsedFile | null = null;
  try {
    const form = formidable({ maxFileSize: MAX_FILE_BYTES, keepExtensions: true, multiples: false });
    const [rawFields, rawFiles] = await new Promise<[FormidableFields, FormidableFiles]>((resolve, reject) => {
      form.parse(req, (err, fld, fls) => (err ? reject(err) : resolve([fld, fls])));
    });
    Object.keys(rawFields).forEach((k) => { fields[k] = firstString(rawFields[k]) ?? ''; });
    const raw = rawFiles.file;
    const picked = Array.isArray(raw) ? raw[0] : raw;
    if (picked) {
      uploadedFile = {
        filepath: picked.filepath,
        originalFilename: picked.originalFilename ?? null,
        mimetype: picked.mimetype ?? null,
        size: picked.size,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid upload.';
    return res.status(400).json({ error: msg.includes('maxFileSize') ? 'File exceeds 4 MB limit.' : 'Invalid upload.' });
  }

  // Build a candidate input from JSON fields.
  const candidate: Record<string, unknown> = { type: fields.type, task_id: fields.task_id };
  if (fields.type !== 'file') candidate.content = fields.content;

  const { data: input, error: validationError } = validate(createEvidenceApiSchema, candidate);
  if (validationError || !input) {
    if (uploadedFile) { try { unlinkSync(uploadedFile.filepath); } catch {} }
    return res.status(400).json({ error: validationError ?? 'Invalid input.' });
  }

  if (input.type === 'file') {
    if (!uploadedFile) return res.status(400).json({ error: 'File is required for type=file.' });
    if (uploadedFile.size > MAX_FILE_BYTES) {
      try { unlinkSync(uploadedFile.filepath); } catch {}
      return res.status(400).json({ error: 'File exceeds 4 MB limit.' });
    }
    if (!uploadedFile.mimetype || !ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
      try { unlinkSync(uploadedFile.filepath); } catch {}
      return res.status(400).json({ error: 'File type not allowed.' });
    }
  }

  // Look up the task (404) and verify group membership (403).
  const { data: task } = await adminClient
    .from('tasks')
    .select('id, group_id, title')
    .eq('id', input.task_id)
    .is('deleted_at', null)
    .single();

  if (!task) {
    if (uploadedFile) { try { unlinkSync(uploadedFile.filepath); } catch {} }
    return res.status(404).json({ error: 'Task not found.' });
  }

  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', task.group_id)
    .eq('profile_id', user.id)
    .single();

  if (!membership) {
    if (uploadedFile) { try { unlinkSync(uploadedFile.filepath); } catch {} }
    return res.status(403).json({ error: 'You are not a member of this group.' });
  }

  // Next version number for this task.
  const { data: existing } = await adminClient
    .from('evidence')
    .select('version_number')
    .eq('task_id', input.task_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (existing?.version_number ?? 0) + 1;

  // For file uploads, upload to Storage first.
  const evidenceId = randomUUID();
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;

  if (input.type === 'file' && uploadedFile) {
    fileName = sanitizeFilename(uploadedFile.originalFilename ?? 'file');
    filePath = buildObjectKey({
      groupId: task.group_id,
      taskId:  task.id,
      evidenceId,
      filename: uploadedFile.originalFilename ?? 'file',
    });
    fileSize = uploadedFile.size;
    mimeType = uploadedFile.mimetype;

    const buffer = readFileSync(uploadedFile.filepath);
    const { error: uploadError } = await adminClient.storage
      .from('evidence')
      .upload(filePath, buffer, {
        contentType: mimeType ?? 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
    try { unlinkSync(uploadedFile.filepath); } catch {}

    if (uploadError) {
      Sentry.captureMessage(`[evidence/create] storage upload: ${uploadError.message}`, { level: 'error' });
      return res.status(500).json({ error: 'Upload failed. Please try again.' });
    }
  }

  // Insert the evidence row. For uploaded files, store filename in `content`
  // so legacy consumers (including lib/pdf.ts) still render a sensible value.
  const contentForRow = input.type === 'file'
    ? (fileName ?? 'file')
    : (input as { content: string }).content.trim();

  const { data: inserted, error: insertError } = await adminClient
    .from('evidence')
    .insert({
      id: evidenceId,
      task_id: input.task_id,
      uploaded_by: user.id,
      type: input.type,
      content: contentForRow,
      version_number: nextVersion,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
    })
    .select('id, task_id, uploaded_by, type, content, version_number, deleted_at, created_at, file_path, file_name, file_size, mime_type')
    .single();

  if (insertError || !inserted) {
    if (filePath) {
      const { error: cleanupError } = await adminClient.storage.from('evidence').remove([filePath]);
      if (cleanupError) Sentry.captureMessage(`[evidence/create] orphan cleanup: ${cleanupError.message}`, { level: 'warning' });
    }
    Sentry.captureMessage(`[evidence/create] insert: ${insertError?.message}`, { level: 'error' });
    return res.status(500).json({ error: 'Failed to save evidence. Please try again.' });
  }

  // activity_log (fire-and-forget)
  adminClient.from('activity_log').insert({
    group_id: task.group_id,
    actor_id: user.id,
    action: nextVersion === 1 ? 'evidence_added' : 'evidence_version_added',
    task_id: task.id,
    meta: { task_title: task.title ?? null },
  }).then(null, () => {});

  // Telegram notify (fire-and-forget, same behavior as before)
  fetch(`${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.cookie ?? '' },
    body: JSON.stringify({
      groupId: task.group_id,
      message: `New evidence logged for "${task.title}"`,
      type: 'contributions',
    }),
  }).catch(() => {});

  return res.status(200).json({ evidence: inserted });
}
