# Evidence — Real File Upload (design)

Status: Draft — pending user review
Date: 2026-04-19
Target: ship one small, low-risk PR that lets students actually upload a file (not just a URL) as evidence.

## Why this change

Today a student "logs evidence" by pasting a Google Drive URL. To do that they must leave Contrib, upload the file in Drive, copy the share link, return to Contrib, paste it. Five steps, two apps, one logical action. The word **upload** in the UI is misleading because nothing is uploaded to Contrib.

This is the single largest "adds work" moment in the student daily loop (see `2026-04-19` audit). Fixing it removes ~30–40% of the daily friction without changing the product model, without touching the Contribution Record's data semantics, and without schema migration to any other table.

## Scope

### In scope (V1)
- Real file upload attached to a task. Stored in Supabase Storage. One file per evidence row.
- File picker UI with allowed types and size limit.
- Download via short-lived signed URL (files stay private).
- Legacy URL-based `file` evidence keeps working unchanged.
- Mutations move through a new API route, complying with the "all mutations through API routes" rule in [CLAUDE.md](contrib/CLAUDE.md).
- `npm run build` passes. Existing evidence rows render identically.

### Out of scope (V1)
- Multiple files per evidence row (use versioning to add more).
- In-browser previews (image thumbnails, PDF rendering). Filename + download is enough.
- Drag-and-drop upload (paste-and-click file picker only).
- Embedding uploaded images inside the exported Contribution Record PDF. The PDF will reference the filename and uploader; the file itself lives in Contrib.
- Reply-to-log via Telegram. Tracked separately.
- Rewriting legacy rows. They stay URL-based forever.

## User story

Dara finishes her slides for the group intro. She taps the task in Contrib, hits "Log your work," picks **Upload file**, selects `intro-slides-v2.pdf` from her phone, confirms. The file uploads. Evidence appears in the task immediately with the filename and a download link. Her teammates see it. Her teacher, looking at the group drill-down from the course page, sees and downloads it. Nobody had to open Drive.

## Architecture

```
┌──────────────┐          1. pick file         ┌───────────────────┐
│  Student UI  │ ───────────────────────────▶  │  evidence-form    │
│ (web/mobile) │                                │  (client)         │
└──────────────┘                                └────────┬──────────┘
                                                         │
                          2. POST /api/evidence/create   │
                             (multipart/form-data)       │
                                                         ▼
                                              ┌───────────────────┐
                                              │  Next API route   │
                                              │  rate-limit + auth│
                                              │  + Zod            │
                                              └────────┬──────────┘
                                                       │
                               3a. upload object       │    3b. insert evidence row
                               to Supabase Storage     │    (adminClient)
                                                       ▼
                                  ┌────────────────────────┐
                                  │  supabase              │
                                  │  Storage bucket +      │
                                  │  evidence table        │
                                  └────────────────────────┘

Download path:
  Client clicks filename → GET /api/evidence/download-url?id=<id>
  → server checks reader has read access → returns 60s signed URL
  → client navigates browser to signed URL.
```

The upload flows server-side through the API route (not direct-to-storage from the client). Reasons:
- Centralizes validation (size, MIME, group membership) in one place.
- Avoids a two-stage client flow (signed upload URL → upload → commit) that has orphan-object edge cases.
- Respects the Vercel 4.5 MB body-size limit by capping uploads at 4 MB in V1 (see "file size" below). Under that limit, proxying is simple and robust.

If we later need larger files, switch to a pre-signed direct upload; schema stays the same.

## Data model

### Schema change — additive, nullable

Add four columns to `evidence`:

```sql
ALTER TABLE public.evidence
  ADD COLUMN file_path  TEXT NULL,
  ADD COLUMN file_name  TEXT NULL,
  ADD COLUMN file_size  INTEGER NULL,
  ADD COLUMN mime_type  TEXT NULL;

COMMENT ON COLUMN public.evidence.file_path IS
  'Storage object path when type = ''file'' and content was uploaded (not a URL). NULL for legacy URL-based file evidence, link, and note.';
```

Written to `database/2026-04-19-evidence-file-upload.sql` as a dated migration and reflected in `database/rls-policies-live.sql` (no policy changes — only the schema comment).

No changes to existing rows. Legacy `type='file'` rows have `file_path = NULL` and `content` holds the URL; they render unchanged.

### `Evidence` TS interface

Extend `types/index.ts`:

```ts
export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  type: EvidenceType;          // 'file' | 'link' | 'note' unchanged
  content: string;              // URL for legacy file / link, text for note, filename for new uploads
  version_number: number;
  deleted_at: string | null;
  created_at: string;
  uploader?: Profile;
  // new
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
}
```

**Convention:** for a new uploaded file, `type='file'`, `file_path` is populated, `content` is set to `file_name` for backwards compatibility with every existing consumer that reads `content`. Renderers that know about `file_path` prefer it; ones that don't still see a sensible string.

## Supabase Storage bucket

Create one bucket: **`evidence`**. Private (not public).

### Object path layout

Bucket: `evidence`. Object key (the value of `storage.objects.name`):

```
{group_id}/{task_id}/{evidence_id}-{sanitized_filename}
```

- `group_id` and `task_id` in the path make storage RLS easy and keep debugging legible.
- `evidence_id` prefix on the filename prevents collisions on same-named files.
- `storage.foldername(name)[1]` then returns `group_id` (Postgres arrays are 1-indexed), which is what the RLS policies below rely on. Verify at implementation time with a quick `SELECT storage.foldername('abc/def/ghi-file.pdf')` before shipping.

### Storage RLS policies

Added in the same dated migration. Two SELECT policies, one INSERT, no UPDATE/DELETE (immutability).

```sql
-- INSERT: authenticated group member of the task's group
CREATE POLICY "evidence bucket insert by group member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND public.user_is_group_member(
      ((storage.foldername(name))[1])::uuid
    )
  );

-- SELECT 1: group member can read files for tasks in their group
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

`user_is_group_member` is an existing SECURITY DEFINER function (per CLAUDE.md rule 8). No new helpers needed.

In practice all reads come through `/api/evidence/download-url` which uses `adminClient`, so storage RLS is defense-in-depth. We still install it.

### Bucket settings

- Public: **false**
- File size limit: **4 MB** (Vercel route body cap). Enforced in both the API route and at the bucket level as a hard fail-safe.
- Allowed MIME types (enforced in API route):
  - `image/png`, `image/jpeg`, `image/webp`, `image/gif`
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
  - `text/plain`
  - `text/csv`

## API routes

### `POST /api/evidence/create`

Replaces the client-side `supabase.from('evidence').insert(...)` call in [evidence-form.tsx:42](contrib/components/evidence-form.tsx:42). Fixes the CLAUDE.md "all mutations through API routes" violation that exists today.

Request:
- `multipart/form-data` for file uploads:
  - `task_id`: uuid
  - `type`: `'file' | 'link' | 'note'`
  - `content`: string (for link/note). Ignored if type=file.
  - `file`: File (required if type=file, max 4 MB)

Response: `{ evidence: Evidence }` on 200. `{ error: string }` on 4xx/5xx.

Server logic:
1. Standard template: 405 check, rate-limit by IP (`RATE_LIMITS.DEFAULT`), `getUserFromApiRoute`.
2. Parse multipart. If type=file: validate file presence, size ≤ 4 MB, MIME in allow-list.
3. Verify the caller is a group member of the task's group (SELECT against `tasks` + `group_members`). 403 if not. This is the same check storage RLS enforces — belt and suspenders.
4. Compute next `version_number` (max(version_number) + 1 for this task, default 1).
5. If type=file: upload to `evidence/{group_id}/{task_id}/{generated_evidence_id}-{sanitizedName}` via `adminClient.storage.from('evidence').upload(...)`. If upload fails, return 500, no DB write.
6. Insert the evidence row. If insert fails and we uploaded a file, best-effort `remove()` to avoid orphan. Log to Sentry either way.
7. Insert activity_log (`evidence_added` or `evidence_version_added`).
8. Fire-and-forget Telegram notify (unchanged from current behavior).
9. Return the inserted row.

### `GET /api/evidence/download-url?id=<evidence_id>`

New route. Returns a 60-second signed URL to the file.

Server logic:
1. 405 if not GET. Rate-limit. `getUserFromApiRoute`.
2. Fetch the evidence row. 404 if not found.
3. Authorize: caller must be a group member of the task's group **or** the course teacher. 403 if not.
4. If `file_path` is NULL, 400 (legacy URL evidence — caller should render `content` as a link directly).
5. `adminClient.storage.from('evidence').createSignedUrl(file_path, 60)`. Return `{ url }`.

## Validation (Zod)

In `lib/validation.ts`:

```ts
export const createEvidenceApiSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    task_id: z.string().uuid('Invalid task.'),
    // file itself is validated outside Zod (multipart)
  }),
  z.object({
    type: z.literal('link'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().url('Must be a valid URL.').max(2000),
  }),
  z.object({
    type: z.literal('note'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().min(1, 'Content is required.').max(2000),
  }),
]);
```

Existing `createEvidenceSchema` stays untouched for any downstream consumer — but the form uses the new API schema via the route.

## Client changes

### `components/evidence-form.tsx`

Replace the `supabase.from('evidence').insert(...)` call with a `fetch('/api/evidence/create', { method: 'POST', body: formData })` call. Add a fourth tab option visually — actually no, keep 3 types:
- **Upload file** — changes from "Shared file" label. File picker. Accepts the MIME types listed above, size ≤ 4 MB.
- **Link** — unchanged.
- **Note** — unchanged.

Rename the existing `file` tab from **Shared file** to **Upload file**. The labeling change makes the semantics honest and lines up with the "log your work" framing rule from CLAUDE.md.

Form behavior:
- On file select, show filename + size + a clear button.
- Submit button disabled while uploading; show "Uploading…" instead of "Logging…".
- On error (size, type, network), show the server-returned error message in the same error slot used today.
- On success, same `onSaved()` callback as today.

### `components/evidence-list.tsx`

Add a branch:
- If `e.file_path` is set → render as **"{file_name} · {human-size} · download"**. Clicking triggers a `fetch('/api/evidence/download-url?id=' + e.id)` then sets `window.location.href = url`.
- Else → render as today (clickable `content` for file/link, text for note).

Keep the existing version badge and uploader line untouched.

### `lib/pdf.ts` (Contribution Record)

Where evidence URLs are rendered today, render filename + " (uploaded)" for new file evidence. No image embedding in V1 — same plain listing, just a sensible label. Legacy URL rows still render as today.

## Edge cases

- **Upload succeeds, DB insert fails.** Attempt `remove()`. If that also fails, log to Sentry with the orphaned path. No user impact — we return a generic 500 and the student can retry.
- **Duplicate submit.** The form already uses `savingRef` to prevent double-submit. Keep.
- **File rename / re-encoding.** `sanitizeFilename` on the server: strip everything outside `[A-Za-z0-9._-]`, truncate to 120 chars. `file_name` stores the sanitized version.
- **Very long filenames on display.** `evidence-list` truncates with CSS `truncate` (max-width) + tooltip.
- **Teacher downloading from `/teacher/course/.../group/...`.** Teachers hit the same `/api/evidence/download-url`; the authorize step allows course teacher. No extra work needed.
- **Legacy "file" rows.** `file_path = NULL`, `content` = Drive URL. `evidence-list` detects NULL and falls back to the hyperlink renderer. No migration, no breakage.
- **Signed URL expiry mid-use.** 60 seconds is enough for click→download. If a student leaves the page open and clicks an hour later, they get a re-request. Acceptable.
- **Evidence created without `file_name` in a non-upload type.** DB permits NULL; renderer only reads `file_name` if `file_path` is set.

## Rollback

- Revert the PR.
- Schema change is additive and nullable; no data migration needed either way.
- Delete the `evidence` Storage bucket if desired (empty until first upload).
- Legacy rows untouched at every step.

## Testing plan

Automated (`vitest`):
- `lib/validation.test.ts`: `createEvidenceApiSchema` discriminated union — file/link/note shapes.
- `__tests__/api/evidence/create.test.ts` (new): membership check rejects non-members with 403; valid request returns 200 with the inserted row; bad MIME rejected with 400; file > 4 MB rejected with 400.

Manual / preview deploy:
- Upload PNG, PDF, DOCX, CSV. Each lands in storage at expected path. Evidence list shows filename. Download works for uploader.
- Upload as group member A, verify member B can see and download. Non-member C gets 403.
- Teacher of the course can download from the group drill-down.
- Legacy URL "file" evidence still renders as a hyperlink.
- Link and note flows unchanged (regression check).
- Export Contribution Record — filenames render cleanly, legacy URLs render as before.
- `npm run build` passes.

## Acceptance

- Student can attach files (PNG/JPG/WEBP/GIF/PDF/DOCX/PPTX/XLSX/TXT/CSV, ≤ 4 MB) to a task.
- Uploaded files display filename in the evidence list; clicking downloads via signed URL.
- Non-members cannot download. Teachers of the course can.
- Link and note evidence behave exactly as before.
- Existing URL-based "file" evidence continues to render and link correctly.
- `evidence-form.tsx` no longer performs a client-side `supabase.from(...).insert(...)` — mutations go through `/api/evidence/create`.
- `npm run build` and existing `vitest` suite pass.

## Files touched (expected)

- `database/2026-04-19-evidence-file-upload.sql` — new, additive schema + storage bucket + storage RLS
- `database/rls-policies-live.sql` — append bucket + storage policies + evidence column comment
- `types/index.ts` — extend `Evidence` with four new fields
- `lib/validation.ts` — add `createEvidenceApiSchema`
- `lib/evidence-upload.ts` — new, small helper for path layout + filename sanitization
- `pages/api/evidence/create.ts` — new
- `pages/api/evidence/download-url.ts` — new
- `components/evidence-form.tsx` — switch to `/api/evidence/create`, add file input UI
- `components/evidence-list.tsx` — branch on `file_path` to render the download affordance
- `lib/pdf.ts` — filename rendering for uploaded files
- `__tests__/api/evidence/create.test.ts` — new unit tests (mocked Supabase)
- `components/whats-new.tsx` — one-line changelog entry

No changes to: group page tabs, task form, teacher pages, onboarding, RLS for the `evidence` table itself.

## Open questions (please review before I plan)

1. **4 MB limit okay for V1?** Student slides/reports can exceed this. If you want to allow larger (up to, say, 20 MB), we switch to direct-to-storage uploads with pre-signed URLs — adds ~1 day of work and one more edge case (orphan objects on abandoned uploads). Cheapest V1 is 4 MB via API proxy. We can raise later.
2. **MIME allow-list okay, or do you want a broader/looser set?** The list above covers the 95% case for student work. Executables, zips, and unknown-binary are excluded — wise for a .edu audience.
3. **Filename as `content` for new uploads** — fine, or would you prefer `content` stay empty for uploaded files? The filename-in-content pattern keeps legacy consumers (including the current PDF generator and the `evidence-list` note renderer) from breaking before they're aware of `file_path`. I'd keep it.
4. **Should we keep the `file` type label as "Upload file" or add a new fourth tab?** I prefer renaming, since it's honest and matches the "log your work" framing. Adding a new tab would force a schema migration in the `EvidenceType` enum — avoidable churn.

If any of the above four answers should be different, call them out and I'll revise.
