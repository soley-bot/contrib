# Evidence File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace URL-only "file" evidence with real file uploads to Supabase Storage. Students pick a file from their device; the file is stored privately in Contrib; download is via short-lived signed URL; teachers can read files for their courses. Legacy URL-based evidence keeps working untouched.

**Architecture:** Client posts `multipart/form-data` to a new API route (`/api/evidence/create`) that parses the file, validates membership, uploads to a private Supabase Storage bucket, and inserts the evidence row. A second route (`/api/evidence/download-url`) returns 60-second signed URLs after an authorization check. Schema change is additive (four nullable columns on `evidence`); legacy rows need no migration.

**Tech Stack:** Next.js 16 Pages Router · Supabase JS 2.99 (storage + Postgres) · Zod 4 · Vitest 4 · formidable (new, for multipart) · jsPDF 4 (read-only touch).

**Spec:** [docs/superpowers/specs/2026-04-19-evidence-file-upload-design.md](../specs/2026-04-19-evidence-file-upload-design.md)

All shell commands run from `contrib/` unless noted otherwise.

---

### Task 1: Create the dated migration file

**Files:**
- Create: `contrib/database/2026-04-19-evidence-file-upload.sql`

- [ ] **Step 1: Write the migration file**

Create `contrib/database/2026-04-19-evidence-file-upload.sql` with:

```sql
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
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "evidence bucket read by group member" ON storage.objects;
CREATE POLICY "evidence bucket read by group member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(name))[1])::uuid
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
      WHERE g.id = ((storage.foldername(name))[1])::uuid
        AND c.teacher_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies on storage.objects for the `evidence` bucket —
-- evidence is immutable (CLAUDE.md constraint #3).
```

- [ ] **Step 2: Append matching policies to the canonical RLS file**

Modify `contrib/database/rls-policies-live.sql`: append a section at the very end (after the last policy):

```sql

-- ── storage: evidence bucket (added 2026-04-19) ────────────────────────────

-- Bucket: public.storage.buckets row with id='evidence', public=false.

-- INSERT: authenticated group member of the task's group
CREATE POLICY "evidence bucket insert by group member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(name))[1])::uuid
    )
  );

-- SELECT 1: group members can read files attached to tasks in their group
CREATE POLICY "evidence bucket read by group member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(name))[1])::uuid
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
      WHERE g.id = ((storage.foldername(name))[1])::uuid
        AND c.teacher_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/database/2026-04-19-evidence-file-upload.sql contrib/database/rls-policies-live.sql
git commit -m "feat(db): add evidence.file_* columns and evidence storage bucket RLS

Additive schema change (four nullable columns) plus a private Supabase
Storage bucket 'evidence' with three RLS policies (insert by group
member, read by group member, read by course teacher). Immutability
preserved — no UPDATE or DELETE policies.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Apply the migration and verify

**Files:** none (Supabase operation)

- [ ] **Step 1: Apply the migration**

Two options, either is fine:

Option A — via Supabase MCP (preferred when available): pass the SQL from `database/2026-04-19-evidence-file-upload.sql` to `apply_migration` with a migration name `2026-04-19-evidence-file-upload`.

Option B — via the Supabase SQL editor: open the project, paste the contents of the file, run.

- [ ] **Step 2: Verify the columns exist**

Run this SELECT in the SQL editor or via MCP `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'evidence'
  AND column_name IN ('file_path', 'file_name', 'file_size', 'mime_type')
ORDER BY column_name;
```

Expected: four rows, all `is_nullable = YES`. If fewer than four rows, something went wrong — do NOT proceed.

- [ ] **Step 3: Verify the storage bucket exists**

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'evidence';
```

Expected: one row, `public = false`.

- [ ] **Step 4: Verify the storage policies exist**

```sql
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'evidence bucket%'
ORDER BY policyname;
```

Expected: three rows — `evidence bucket insert by group member`, `evidence bucket read by course teacher`, `evidence bucket read by group member`.

- [ ] **Step 5: No commit — this is infra verification**

---

### Task 3: Install formidable

**Files:**
- Modify: `contrib/package.json`, `contrib/package-lock.json`

- [ ] **Step 1: Install the dependency**

```bash
cd contrib
npm install formidable@^3.5.2
```

`formidable` v3 ships its own TypeScript types, so no separate `@types/formidable` install is needed.

- [ ] **Step 2: Verify the install**

```bash
cd contrib
npm ls formidable
```

Expected: `formidable@3.5.x` listed, no peer-dep warnings.

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

```bash
cd contrib
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/package.json contrib/package-lock.json
git commit -m "chore(deps): add formidable for multipart evidence uploads

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Extend the Evidence TypeScript type

**Files:**
- Modify: `contrib/types/index.ts` (around line 65 — the `Evidence` interface)

- [ ] **Step 1: Add four nullable fields**

In `contrib/types/index.ts`, replace the existing `Evidence` interface with:

```ts
export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  type: EvidenceType;
  content: string;
  version_number: number;
  deleted_at: string | null;
  created_at: string;
  uploader?: Profile;
  // File upload metadata — populated only when an uploaded file (not a URL) is stored.
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
}
```

- [ ] **Step 2: Run the type checker**

```bash
cd contrib
npx tsc --noEmit
```

Expected: no errors. (The new fields are nullable, so consumers that read the old fields keep compiling.)

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/types/index.ts
git commit -m "feat(types): extend Evidence with file upload metadata fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create the evidence-upload helper (TDD)

**Files:**
- Create: `contrib/lib/evidence-upload.ts`
- Create: `contrib/__tests__/lib/evidence-upload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `contrib/__tests__/lib/evidence-upload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeFilename, buildObjectKey, MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from '@/lib/evidence-upload';

describe('sanitizeFilename', () => {
  it('keeps alphanumeric, dot, dash, underscore', () => {
    expect(sanitizeFilename('intro-slides_v2.pdf')).toBe('intro-slides_v2.pdf');
  });

  it('replaces unsafe chars with underscore', () => {
    expect(sanitizeFilename('My File (final)!.pdf')).toBe('My_File__final__.pdf');
  });

  it('strips directory traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('______etc_passwd');
  });

  it('truncates to 120 chars, preserving extension', () => {
    const long = 'a'.repeat(200) + '.pdf';
    const out = sanitizeFilename(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith('.pdf')).toBe(true);
  });

  it('returns "file" for empty input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('   ')).toBe('file');
  });
});

describe('buildObjectKey', () => {
  it('composes {group_id}/{task_id}/{evidence_id}-{filename}', () => {
    const key = buildObjectKey({
      groupId: '11111111-1111-1111-1111-111111111111',
      taskId:  '22222222-2222-2222-2222-222222222222',
      evidenceId: '33333333-3333-3333-3333-333333333333',
      filename: 'slides.pdf',
    });
    expect(key).toBe(
      '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333-slides.pdf'
    );
  });

  it('sanitizes the filename component', () => {
    const key = buildObjectKey({
      groupId: 'g', taskId: 't', evidenceId: 'e',
      filename: 'My Slides!.pdf',
    });
    expect(key).toBe('g/t/e-My_Slides_.pdf');
  });
});

describe('constants', () => {
  it('MAX_FILE_BYTES is 4 MB', () => {
    expect(MAX_FILE_BYTES).toBe(4 * 1024 * 1024);
  });

  it('ALLOWED_MIME_TYPES includes the expected set', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-msdownload'); // .exe
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd contrib
npx vitest run __tests__/lib/evidence-upload.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/evidence-upload'".

- [ ] **Step 3: Implement the helper**

Create `contrib/lib/evidence-upload.ts`:

```ts
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

  // Preserve extension if present and short enough.
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd contrib
npx vitest run __tests__/lib/evidence-upload.test.ts
```

Expected: PASS (11 assertions).

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/lib/evidence-upload.ts contrib/__tests__/lib/evidence-upload.test.ts
git commit -m "feat(evidence): add filename sanitization and object-key helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add the Zod schema for the API (TDD)

**Files:**
- Modify: `contrib/lib/validation.ts`
- Modify: `contrib/__tests__/lib/validation.test.ts`

- [ ] **Step 1: Add tests**

Append to `contrib/__tests__/lib/validation.test.ts`:

```ts
import { createEvidenceApiSchema } from '@/lib/validation';

describe('createEvidenceApiSchema', () => {
  it('accepts a valid file payload (no content required — file is multipart)', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'file',
      task_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid link payload', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'link',
      task_id: '11111111-1111-1111-1111-111111111111',
      content: 'https://drive.google.com/abc',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid note payload', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'note',
      task_id: '11111111-1111-1111-1111-111111111111',
      content: 'I wrote the intro paragraph.',
    });
    expect(r.success).toBe(true);
  });

  it('rejects link without a URL', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'link',
      task_id: '11111111-1111-1111-1111-111111111111',
      content: 'not a url',
    });
    expect(r.success).toBe(false);
  });

  it('rejects note with empty content', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'note',
      task_id: '11111111-1111-1111-1111-111111111111',
      content: '   ',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown type', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'video',
      task_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid task_id uuid', () => {
    const r = createEvidenceApiSchema.safeParse({
      type: 'note',
      task_id: 'not-a-uuid',
      content: 'hi',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd contrib
npx vitest run __tests__/lib/validation.test.ts -t createEvidenceApiSchema
```

Expected: FAIL with "createEvidenceApiSchema is not exported" (or similar).

- [ ] **Step 3: Add the schema**

In `contrib/lib/validation.ts`, insert after the existing `createEvidenceSchema` block (around line 74):

```ts
// ── Evidence API (server-side, discriminated by type) ──────────────────────
// Used by POST /api/evidence/create. The `file` branch carries no `content`
// in the JSON part — the actual file is a multipart field.

export const createEvidenceApiSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    task_id: z.string().uuid('Invalid task.'),
  }),
  z.object({
    type: z.literal('link'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().url('Must be a valid URL.').max(2000, 'URL is too long.'),
  }),
  z.object({
    type: z.literal('note'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().min(1, 'Content is required.').max(2000, 'Note is too long (max 2000).'),
  }),
]);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd contrib
npx vitest run __tests__/lib/validation.test.ts
```

Expected: the new 7 assertions PASS. The pre-existing assertions remain PASS.

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/lib/validation.ts contrib/__tests__/lib/validation.test.ts
git commit -m "feat(validation): add createEvidenceApiSchema discriminated union

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Create POST /api/evidence/create

**Files:**
- Create: `contrib/pages/api/evidence/create.ts`
- Create: `contrib/__tests__/api/evidence-create.test.ts`

- [ ] **Step 1: Write auth/validation unit tests**

Create `contrib/__tests__/api/evidence-create.test.ts`. These are unit tests for the non-IO branches only — file upload and Storage writes are verified manually in the final task.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock rate limit (always pass)
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: () => '127.0.0.1',
  RATE_LIMITS: { DEFAULT: { limit: 60, window: '1 m' } },
}));

// Mock auth — returns a user id by default; null when `returnNullUser` set
const authState = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('@/lib/supabase-server', () => ({
  getUserFromApiRoute: vi.fn(async () => authState.user),
}));

// Mock adminClient with a chainable thenable
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockIs = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, is: mockIs, single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
vi.mock('@/lib/supabase-admin', () => ({
  adminClient: { from: (...a: unknown[]) => mockFrom(...a), storage: { from: vi.fn() } },
}));

// Mock formidable so no real filesystem IO happens
vi.mock('formidable', () => ({
  default: () => ({
    parse: (_req: unknown, cb: (err: Error | null, fields: Record<string, string[]>, files: Record<string, unknown>) => void) =>
      cb(null, { type: ['note'], task_id: ['11111111-1111-1111-1111-111111111111'], content: ['ok'] }, {}),
  }),
}));

import handler from '@/pages/api/evidence/create';

function makeReqRes(method = 'POST') {
  const req = { method, headers: {}, on: vi.fn(), pipe: vi.fn() } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn(() => ({ json, end: vi.fn() }));
  const res = { status, json, end: vi.fn() } as unknown as NextApiResponse;
  return { req, res, status, json };
}

describe('POST /api/evidence/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1' };
  });

  it('returns 405 for non-POST', async () => {
    const { req, res, status } = makeReqRes('GET');
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.user = null;
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when user is not a group member', async () => {
    // tasks.select -> returns a task; group_members.select -> returns nothing
    mockSingle
      .mockResolvedValueOnce({ data: { id: 't1', group_id: 'g1' }, error: null })   // tasks lookup
      .mockResolvedValueOnce({ data: null, error: null });                          // group_members check
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when task does not exist', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const { req, res, status } = makeReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd contrib
npx vitest run __tests__/api/evidence-create.test.ts
```

Expected: FAIL with "Cannot find module '@/pages/api/evidence/create'".

- [ ] **Step 3: Implement the API route**

Create `contrib/pages/api/evidence/create.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import formidable from 'formidable';
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
  let fields: ParsedField = {};
  let uploadedFile: ParsedFile | null = null;
  try {
    const form = formidable({ maxFileSize: MAX_FILE_BYTES, keepExtensions: true, multiples: false });
    const [rawFields, rawFiles] = await new Promise<[Record<string, string[]>, Record<string, formidable.File | formidable.File[]>]>((resolve, reject) => {
      form.parse(req, (err, fld, fls) => (err ? reject(err) : resolve([fld as Record<string, string[]>, fls as Record<string, formidable.File | formidable.File[]>])));
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
    // Clean up the uploaded object on insert failure.
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd contrib
npx vitest run __tests__/api/evidence-create.test.ts
```

Expected: all 4 test cases PASS. The mocks cover 405/401/403/404 paths; the happy-file-upload path is intentionally covered in manual verification (Task 12).

- [ ] **Step 5: Run the type checker**

```bash
cd contrib
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/pages/api/evidence/create.ts contrib/__tests__/api/evidence-create.test.ts
git commit -m "feat(api): POST /api/evidence/create — multipart + storage upload

Adds the server route that fully replaces the client-side insert in
evidence-form.tsx. Enforces 4 MB cap, MIME allow-list, and group
membership. On insert failure, attempts to remove the orphaned object.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Create GET /api/evidence/download-url

**Files:**
- Create: `contrib/pages/api/evidence/download-url.ts`
- Create: `contrib/__tests__/api/evidence-download-url.test.ts`

- [ ] **Step 1: Write auth tests**

Create `contrib/__tests__/api/evidence-download-url.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: () => '127.0.0.1',
  RATE_LIMITS: { DEFAULT: { limit: 60, window: '1 m' } },
}));

const authState = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('@/lib/supabase-server', () => ({
  getUserFromApiRoute: vi.fn(async () => authState.user),
}));

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed/abc' }, error: null });
vi.mock('@/lib/supabase-admin', () => ({
  adminClient: {
    from: (...a: unknown[]) => mockFrom(...a),
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}));

import handler from '@/pages/api/evidence/download-url';

function makeReqRes(method = 'GET', query: Record<string, string> = {}) {
  const req = { method, headers: {}, query } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn(() => ({ json, end: vi.fn() }));
  const res = { status, json, end: vi.fn() } as unknown as NextApiResponse;
  return { req, res, status, json };
}

describe('GET /api/evidence/download-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1' };
  });

  it('405 for non-GET', async () => {
    const { req, res, status } = makeReqRes('POST', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('401 when unauthenticated', async () => {
    authState.user = null;
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('400 when id missing', async () => {
    const { req, res, status } = makeReqRes('GET', {});
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('404 when evidence not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('400 when evidence has no file_path (legacy URL row)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'e1', task_id: 't1', file_path: null, tasks: { group_id: 'g1' } },
      error: null,
    });
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('403 when caller is neither group member nor course teacher', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'e1', task_id: 't1', file_path: 'g1/t1/e1-x.pdf', tasks: { group_id: 'g1' } }, error: null })  // evidence
      .mockResolvedValueOnce({ data: null, error: null })   // group_members check
      .mockResolvedValueOnce({ data: null, error: null });  // course teacher check
    const { req, res, status } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('200 with signedUrl for a group member', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'e1', task_id: 't1', file_path: 'g1/t1/e1-x.pdf', tasks: { group_id: 'g1' } }, error: null })
      .mockResolvedValueOnce({ data: { id: 'm1' }, error: null }); // member
    const { req, res, status, json } = makeReqRes('GET', { id: 'e1' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ url: 'https://signed/abc' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd contrib
npx vitest run __tests__/api/evidence-download-url.test.ts
```

Expected: FAIL with "Cannot find module '@/pages/api/evidence/download-url'".

- [ ] **Step 3: Implement the route**

Create `contrib/pages/api/evidence/download-url.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const SIGNED_URL_TTL_SECONDS = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`evidence-download:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return res.status(400).json({ error: 'Missing evidence id.' });

  const { data: evidence } = await adminClient
    .from('evidence')
    .select('id, task_id, file_path, tasks!inner(group_id)')
    .eq('id', id)
    .single();

  if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
  if (!evidence.file_path) return res.status(400).json({ error: 'This evidence has no uploaded file.' });

  // Extract group_id from the joined task.
  const groupId = (evidence.tasks as unknown as { group_id: string }).group_id;

  // Authorize: group member OR course teacher.
  const { data: member } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  let authorized = !!member;

  if (!authorized) {
    const { data: teacherOwned } = await adminClient
      .from('groups')
      .select('courses!inner(teacher_id)')
      .eq('id', groupId)
      .single();
    const teacherId = (teacherOwned?.courses as unknown as { teacher_id: string } | null)?.teacher_id;
    authorized = teacherId === user.id;
  }

  if (!authorized) return res.status(403).json({ error: 'Forbidden.' });

  const { data, error } = await adminClient.storage
    .from('evidence')
    .createSignedUrl(evidence.file_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    Sentry.captureMessage(`[evidence/download-url] sign: ${error?.message ?? 'no url'}`, { level: 'error' });
    return res.status(500).json({ error: 'Could not generate download link.' });
  }

  return res.status(200).json({ url: data.signedUrl });
}
```

- [ ] **Step 4: Run tests**

```bash
cd contrib
npx vitest run __tests__/api/evidence-download-url.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Type-check**

```bash
cd contrib
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/pages/api/evidence/download-url.ts contrib/__tests__/api/evidence-download-url.test.ts
git commit -m "feat(api): GET /api/evidence/download-url — signed URL + auth

Authorizes group members and the course teacher. Returns 60-second
signed URLs. Returns 400 for legacy URL-based evidence (caller should
render content directly in that case).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Update evidence-form.tsx (client)

**Files:**
- Modify: `contrib/components/evidence-form.tsx`

- [ ] **Step 1: Replace the component body**

Overwrite `contrib/components/evidence-form.tsx` with:

```tsx
import { useRef, useState } from 'react';
import type { EvidenceType } from '@/types';

interface EvidenceFormProps {
  taskId: string;
  taskTitle: string;
  groupId: string;
  userId: string;
  nextVersion: number;
  onSaved: () => void;
  onCancel: () => void;
}

type TabDef = { value: EvidenceType; label: string; hint: string };

const TABS: TabDef[] = [
  { value: 'file', label: 'Upload file', hint: 'Pick a file from your device (PDF, image, docx, up to 4 MB).' },
  { value: 'link', label: 'Link',        hint: 'Paste a shareable URL.' },
  { value: 'note', label: 'Note',        hint: 'Describe what you did.' },
];

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceForm({ taskId, taskTitle, groupId, userId, nextVersion, onSaved, onCancel }: EvidenceFormProps) {
  const [type, setType] = useState<EvidenceType>('file');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // userId is passed through for activity_log consumers; not used directly here since the API
  // route reads the authenticated user from the session.
  void userId;
  void groupId;

  async function handleSubmit() {
    if (savingRef.current) return;
    savingRef.current = true;
    setError('');

    if (type === 'file') {
      if (!file) { setError('Choose a file to upload.'); savingRef.current = false; return; }
      if (file.size > MAX_FILE_BYTES) { setError('File exceeds 4 MB limit.'); savingRef.current = false; return; }
    } else if (type === 'link') {
      if (!/^https?:\/\//i.test(content.trim())) { setError('Enter a valid URL starting with http:// or https://'); savingRef.current = false; return; }
    } else {
      if (!content.trim()) { setError('Write a short note.'); savingRef.current = false; return; }
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('task_id', taskId);
      if (type === 'file' && file) form.append('file', file);
      else form.append('content', content.trim());

      const resp = await fetch('/api/evidence/create', { method: 'POST', body: form });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error ?? 'Failed to save evidence.');
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
      setSaving(false);
    } finally {
      savingRef.current = false;
    }
  }

  const active = TABS.find((t) => t.value === type)!;

  return (
    <div aria-label="Log your work" className="flex flex-col gap-3 bg-bg border border-border rounded-md p-3">
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t.value} type="button"
            onClick={() => { setType(t.value); setContent(''); setFile(null); setError(''); }}
            className={`flex-1 h-8 rounded-md text-[12px] font-medium border transition-colors ${
              type === t.value ? 'bg-brand text-white border-brand' : 'bg-white text-text-secondary border-border'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-text-tertiary">{active.hint}</p>

      {type === 'file' ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setError(''); }}
            className="text-[13px]"
          />
          {file && (
            <p className="text-[12px] text-text-secondary">
              {file.name} · {formatSize(file.size)}{' '}
              <button type="button" className="text-brand underline" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                clear
              </button>
            </p>
          )}
        </div>
      ) : type === 'note' ? (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={2000}
          placeholder="Describe what you did…"
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none resize-none bg-white" />
      ) : (
        <input type="url" value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000}
          placeholder="https://…"
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none bg-white" />
      )}

      {error && <p role="alert" className="text-xs text-red">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border border-border text-[13px] font-medium text-text-secondary rounded-md hover:bg-bg-hover transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="flex-1 h-9 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60">
          {saving ? (type === 'file' ? 'Uploading…' : 'Saving…') : nextVersion === 1 ? 'Log your work' : 'Add version'}
        </button>
      </div>
    </div>
  );
}
```

Note on prop compatibility: the component still accepts `taskTitle`, `userId`, and `groupId` for backwards compatibility with callers, but now delegates activity-log and notify writes to the API route. `taskTitle` is unused in the client now; leave the prop for interface stability (removing it is a separate refactor).

- [ ] **Step 2: Type-check**

```bash
cd contrib
npx tsc --noEmit
```

Expected: no errors. (`taskTitle` will show as unused but is still in the props interface; if the linter complains, prefix with `_` or add a `void taskTitle;` statement.)

If TS complains about `taskTitle` being unused, add `void taskTitle;` alongside the existing `void userId; void groupId;` lines.

- [ ] **Step 3: Run the full test suite**

```bash
cd contrib
npm test
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/components/evidence-form.tsx
git commit -m "feat(evidence): real file upload in evidence-form

Switches submission from client-side insert to POST /api/evidence/create,
fixing the CLAUDE.md 'mutations via API routes' violation. Adds a native
file picker bound to the allow-listed MIME types. Tab renamed from
'Shared file' to 'Upload file'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Update evidence-list.tsx to render downloads

**Files:**
- Modify: `contrib/components/evidence-list.tsx`

- [ ] **Step 1: Replace the component body**

Overwrite `contrib/components/evidence-list.tsx` with:

```tsx
import { useState } from 'react';
import type { Evidence, EvidenceType } from '@/types';

const TYPE_LABEL: Record<EvidenceType, string> = { file: 'File', link: 'Link', note: 'Note' };
const TYPE_COLOR: Record<EvidenceType, string> = {
  file: 'bg-brand-light text-brand',
  link: 'bg-brand-light text-brand',
  note: 'bg-[#F0FDF4] text-green',
};

interface EvidenceListProps {
  evidence: Evidence[];
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceList({ evidence }: EvidenceListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleDownload(e: Evidence) {
    if (downloadingId) return;
    setDownloadingId(e.id);
    setRowError((prev) => ({ ...prev, [e.id]: '' }));
    try {
      const resp = await fetch(`/api/evidence/download-url?id=${encodeURIComponent(e.id)}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.url) {
        setRowError((prev) => ({ ...prev, [e.id]: data.error ?? 'Download failed.' }));
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setRowError((prev) => ({ ...prev, [e.id]: 'Network error.' }));
    } finally {
      setDownloadingId(null);
    }
  }

  if (evidence.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {evidence.map((e) => {
        const isUploadedFile = e.type === 'file' && !!e.file_path;
        return (
          <div key={e.id} className="bg-bg border border-border rounded-md p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>
              <span className="text-[11px] font-semibold text-text-tertiary">v{e.version_number}</span>
              <span className="ml-auto text-[11px] text-text-tertiary">
                {new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {e.type === 'note' ? (
              <p className="text-[13px] text-text leading-relaxed">{e.content}</p>
            ) : isUploadedFile ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button"
                  disabled={downloadingId === e.id}
                  onClick={() => handleDownload(e)}
                  className="text-[13px] text-brand underline break-all text-left disabled:opacity-60"
                  aria-label={`Download ${e.file_name ?? e.content}`}>
                  {e.file_name ?? e.content}
                </button>
                {e.file_size != null && (
                  <span className="text-[11px] text-text-tertiary">· {formatSize(e.file_size)}</span>
                )}
                {downloadingId === e.id && <span className="text-[11px] text-text-tertiary">· fetching link…</span>}
              </div>
            ) : (
              <a href={e.content} target="_blank" rel="noopener noreferrer"
                className="text-[13px] text-brand underline break-all">
                {e.content}
              </a>
            )}
            {rowError[e.id] && <p role="alert" className="mt-1 text-[11px] text-red">{rowError[e.id]}</p>}
            {e.uploader && (
              <p className="text-[11px] text-text-tertiary mt-1.5">by {e.uploader.name}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and test**

```bash
cd contrib
npx tsc --noEmit && npm test
```

Expected: no TS errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/components/evidence-list.tsx
git commit -m "feat(evidence): render uploaded files with signed-URL download

Legacy URL-based file evidence keeps its hyperlink rendering. New
uploaded files fetch a 60-second signed URL on click and navigate to
it. Notes render unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Update the PDF Contribution Record

**Files:**
- Modify: `contrib/lib/pdf.ts` (around line 484-495)

- [ ] **Step 1: Adjust the evidence label**

In `contrib/lib/pdf.ts`, locate the block:

```ts
const taskEvidence = evidenceByTask[t.id] ?? [];
if (taskEvidence.length > 0) {
  const latest = taskEvidence[taskEvidence.length - 1];
  const label  = latest.type === 'note'
    ? `[note] ${truncate(latest.content, 50)}`
    : `[${latest.type}] ${truncate(latest.content, 45)}`;
  doc.setTextColor(22, 163, 74);
  doc.text(label, PW - MR - 2, y, { align: 'right', maxWidth: 90 });
}
```

Replace with:

```ts
const taskEvidence = evidenceByTask[t.id] ?? [];
if (taskEvidence.length > 0) {
  const latest = taskEvidence[taskEvidence.length - 1];
  let label: string;
  if (latest.type === 'note') {
    label = `[note] ${truncate(latest.content, 50)}`;
  } else if (latest.type === 'file' && latest.file_path) {
    // Uploaded file — render filename, never a raw storage path.
    label = `[file] ${truncate(latest.file_name ?? latest.content, 45)} (uploaded)`;
  } else {
    // Legacy URL-based file or link.
    label = `[${latest.type}] ${truncate(latest.content, 45)}`;
  }
  doc.setTextColor(22, 163, 74);
  doc.text(label, PW - MR - 2, y, { align: 'right', maxWidth: 90 });
}
```

- [ ] **Step 2: Type-check**

```bash
cd contrib
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/lib/pdf.ts
git commit -m "feat(pdf): render uploaded evidence as filename + (uploaded)

Legacy URL-based evidence unchanged. Uploaded files show the original
filename with an (uploaded) suffix, never the raw storage path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Changelog and final verification

**Files:**
- Modify: `contrib/components/whats-new.tsx`

- [ ] **Step 1: Add a changelog entry**

Open `contrib/components/whats-new.tsx` and add one new entry at the top of the entries array (pattern: copy the shape of the most recent entry). Example entry content:

```tsx
{
  date: '2026-04-19',
  title: 'Upload real files as evidence',
  body: 'The "Upload file" option now accepts files directly from your device — PDFs, images, slides, up to 4 MB. Links and notes still work the same way. Older Drive links continue to work.',
},
```

The exact shape must match whatever interface the existing entries use; do not invent fields.

- [ ] **Step 2: Run the full test suite**

```bash
cd contrib
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Type-check and build**

```bash
cd contrib
npx tsc --noEmit && npm run build
```

Expected: no TS errors; build succeeds.

- [ ] **Step 4: Manual smoke test on dev**

```bash
cd contrib
npm run dev
```

Then in a browser, while logged in as a student who is a member of a group with at least one task:

1. Open the task drawer, click "Log your work."
2. With the **Upload file** tab selected, pick a PDF under 4 MB → click **Log your work** → evidence row appears with the filename and download link.
3. Click the filename → file downloads.
4. Try uploading an EXE file → see "File type not allowed."
5. Try a file over 4 MB → see "File exceeds 4 MB limit."
6. Switch to **Link** tab, paste a URL → works as before.
7. Switch to **Note** tab, write a note → works as before.
8. Log in as the group's teacher (via course page), navigate to the group drill-down → verify the same filename appears and downloads.
9. Log in as an unrelated user (different course) → confirm they cannot reach this task's group, and that direct calls to `/api/evidence/download-url?id=...` for a foreign file return 403 (quick way: hit the URL with fetch in the browser console).
10. Export the Contribution Record PDF — verify the filename (not a URL) appears in the evidence column.
11. Load an older record that still has URL-based file evidence — confirm it still renders as a hyperlink in both the UI and the PDF.

If any of steps 2–11 fails, open an issue and fix before shipping.

- [ ] **Step 5: Commit the changelog**

```bash
cd "$(git rev-parse --show-toplevel)"
git add contrib/components/whats-new.tsx
git commit -m "docs: changelog entry for evidence file uploads

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Final status check**

```bash
cd "$(git rev-parse --show-toplevel)"
git log --oneline -12
git status
```

Expected: 10–11 commits added since the spec commit, working tree clean (apart from whatever untracked files were present before you started).

---

## Post-implementation

Once CI is green on the feature branch and the manual smoke test above has passed on a Vercel preview deploy, merge to `main`. No feature flag needed — legacy behavior is preserved everywhere, and the new upload path is inert until a student actually picks a file.

If a rollback becomes necessary after merge:

1. Revert the feature PR in git.
2. Leave the storage bucket and the new columns in place — they are inert with the code reverted.
3. No data migration is needed either way.

## Self-review notes

- Spec coverage: every requirement in the spec's "Acceptance" list maps to tasks 1–12. The V1 cap (4 MB), MIME allow-list, legacy rendering, teacher download, and the client-side-insert removal are each covered.
- No placeholders: every code block is concrete; no `TODO` or `TBD`.
- Type consistency: `file_path`, `file_name`, `file_size`, `mime_type` all plumbed end-to-end with the same names in schema, TypeScript, API, and both client components.
- Collision check: the plan does not touch group pages, task form, teacher pages, or RLS on the `evidence` table itself.
