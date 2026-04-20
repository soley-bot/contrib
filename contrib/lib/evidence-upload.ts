/**
 * Helpers for evidence file uploads. Pure functions only — no IO.
 */

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel body limit

export const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // .pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // .xlsx
  'text/plain',
  'text/csv',
] as const;

const MAX_FILENAME_LENGTH = 120;

/**
 * Replace every character that is not alphanumeric, dot, dash, or underscore
 * with an underscore. Truncate to MAX_FILENAME_LENGTH while preserving the
 * extension if possible. Returns 'file' for empty input.
 */
export function sanitizeFilename(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'file';

  const replaced = trimmed.replace(/[^A-Za-z0-9._-]/g, '_');
  if (replaced.length <= MAX_FILENAME_LENGTH) return replaced;

  const dot = replaced.lastIndexOf('.');
  if (dot > 0 && replaced.length - dot <= 10) {
    const ext = replaced.slice(dot);
    const stemBudget = MAX_FILENAME_LENGTH - ext.length;
    return replaced.slice(0, stemBudget) + ext;
  }
  return replaced.slice(0, MAX_FILENAME_LENGTH);
}

export interface BuildObjectKeyInput {
  groupId: string;
  taskId: string;
  evidenceId: string;
  filename: string;
}

export function buildObjectKey({ groupId, taskId, evidenceId, filename }: BuildObjectKeyInput): string {
  return `${groupId}/${taskId}/${evidenceId}-${sanitizeFilename(filename)}`;
}
