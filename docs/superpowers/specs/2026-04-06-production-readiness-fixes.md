# Production Readiness Fixes — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Fix all critical, high, and medium bugs identified in production readiness audit

---

## Overview

Production readiness audit found 4 critical, 6 high, and 7 medium issues. This spec covers fixes for all of them, organized by the file(s) they touch.

---

## Fix 1: Explicit column selects in hooks (C2)

**Problem:** `use-tasks.ts`, `use-evidence.ts`, `use-task-comments.ts` use `select('*')` on both main table and profile joins, leaking all columns to the browser.

**Solution:** Create `lib/columns.ts` with a shared `PROFILE_SELECT` constant. Replace all `select('*')` with explicit column lists.

```ts
// lib/columns.ts
export const PROFILE_SELECT = 'id, name, university, faculty, year_of_study, avatar_url, role';
```

**Files changed:**
- `lib/columns.ts` (new)
- `hooks/use-tasks.ts` — line 45
- `hooks/use-evidence.ts` — line 42
- `hooks/use-task-comments.ts` — line 45

---

## Fix 2: Remove `invite_token` from bulk client hooks (C3)

**Problem:** `use-course.ts` and `use-courses.ts` fetch `invite_token` for all groups/courses client-side. Tokens are visible in browser DevTools.

**Solution:** Remove `invite_token` from the select in both hooks. The invite token is only needed when the user explicitly clicks "Copy invite link" — fetch it on demand via a dedicated server call or the existing reset-invite endpoint response.

**Files changed:**
- `hooks/use-course.ts` — line 31: remove `invite_token` from groups select
- `hooks/use-courses.ts` — line 42: remove `invite_token` from courses select

**Downstream impact:** Any UI that reads `course.invite_token` or `group.invite_token` from these hooks needs to fetch the token separately. The teacher course page copies course invite links — this will need a small server-side fetch. Group invite tokens within the course page were already only used for display, not for the copy action (the copy action is on the student group page, covered by Fix 3).

---

## Fix 3: Add `invite_token` to `useGroup` hook (C4)

**Problem:** `useGroup` doesn't select `invite_token`, so `group.invite_token` is `undefined`. The "Copy invite link" button generates `/join/undefined`.

**Solution:** Add `invite_token` to the select in `useGroup`. This is the group lead's own group — they need the token to share the invite link. RLS already restricts group reads to members only.

**Files changed:**
- `hooks/use-group.ts` — line 47: add `invite_token` to select

---

## Fix 4: Security headers (H5)

**Problem:** `next.config.ts` only sets CSP. Missing `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`.

**Solution:** Add standard security headers to the existing `headers()` function.

```ts
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

**Files changed:**
- `next.config.ts` — `headers()` array

---

## Fix 5: New API route for course join (H6)

**Problem:** `pages/join/course/[token].tsx` does a direct client-side `supabase.from('course_members').insert(...)`. No rate limiting, no role check (teachers can join as students), no Zod validation, no Sentry logging.

**Solution:** Create `pages/api/courses/[id]/join.ts` following the standard API route template. The join page calls this instead of the direct insert.

**API route: `POST /api/courses/[id]/join`**
- Rate limit: `RATE_LIMITS.DEFAULT` (10/min) keyed by IP
- Auth: `getUserFromApiRoute` — must be authenticated
- Role check: caller must be a student (`profile.role === 'student'`), return 403 for teachers
- Duplicate check: if already in `course_members`, return 200 with `{ already: true }`
- Insert into `course_members`
- Return 200 with `{ joined: true }`

**Files changed:**
- `pages/api/courses/[id]/join.ts` (new)
- `pages/join/course/[token].tsx` — replace direct insert with `fetch('/api/courses/${course.id}/join', ...)`

---

## Fix 6: New API route for onboarding profile (M4)

**Problem:** `pages/onboarding.tsx` upserts profile directly via client-side Supabase. A user can set `role: 'teacher'` via a direct API call, even though the intent is role selection happens only through the UI.

**Severity reassessment:** This is actually more critical than M4 suggests — it's a privilege escalation vector. A student can become a teacher by sending one Supabase request.

**Solution:** Create `pages/api/profile/onboard.ts`. The onboarding page calls this instead of the direct upsert.

**API route: `POST /api/profile/onboard`**
- Rate limit: 5/min per IP
- Auth: `getUserFromApiRoute` — must be authenticated
- Validate with Zod: `name` (required, 1-100 chars), `university` (optional, max 200), `faculty` (optional, max 200), `year_of_study` (optional, enum of valid values), `role` (required, enum `student` | `teacher`)
- Check if profile already exists — if so, return 409 (prevents re-onboarding to change role)
- Insert profile with `adminClient`
- Return 200

**Validation schema (add to `lib/validation.ts`):**
```ts
export const onboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  university: z.string().trim().max(200).optional().default(''),
  faculty: z.string().trim().max(200).optional().default(''),
  year_of_study: z.enum(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5 or above']).nullable().optional(),
  role: z.enum(['student', 'teacher']),
});
```

**Files changed:**
- `lib/validation.ts` — add `onboardSchema`
- `pages/api/profile/onboard.ts` (new)
- `pages/onboarding.tsx` — replace direct upsert with `fetch('/api/profile/onboard', ...)`

---

## Fix 7: Archived group guard on `transfer-lead` (H4)

**Problem:** `transfer-lead.ts` doesn't check `archived_at`. Lead can be transferred on dead groups.

**Solution:** Add `archived_at` to the select and return 410 if set.

**Files changed:**
- `pages/api/groups/[id]/transfer-lead.ts`

---

## Fix 8: Per-email rate limit on forgot-password (H3)

**Problem:** Only IP-based rate limiting. One IP can flood password reset emails for many email addresses.

**Solution:** Add a second rate limit check keyed by email hash after the existing IP check.

```ts
const emailKey = `forgot-password:email:${parsed.data.email.toLowerCase()}`;
if (!(await rateLimit(emailKey, 3, 3600_000)))
  return res.status(429).json({ error: 'Too many requests for this email.' });
```

**Files changed:**
- `pages/api/auth/forgot-password.ts`

---

## Fix 9: `maxDuration` for cron function (M6)

**Problem:** The cron daily digest does N+1 queries per teacher per course. No `maxDuration` in `vercel.json` means it hits the default timeout.

**Solution:** Add function config to `vercel.json`.

```json
"functions": {
  "pages/api/cron/daily.ts": { "maxDuration": 60 }
}
```

**Files changed:**
- `vercel.json`

---

## Fix 10: Course delete atomicity (H1)

**Problem:** Seven independent deletes run in sequence. A failure in the middle leaves orphaned data while continuing to delete the course.

**Solution:** Wrap the cascade in a check-before-proceed pattern. If any batch fails, return 500 immediately instead of continuing. Add the group IDs and course ID to the Sentry context for debugging partial failures.

This is a conservative fix — the ideal fix is `ON DELETE CASCADE` at the DB level, but that's a migration and out of scope for this pass. The code fix stops the bleeding.

**Files changed:**
- `pages/api/courses/[id]/delete.ts`

---

## Fix 11: Cron N+1 query optimization (H2)

**Problem:** For each teacher, for each course, 7 sequential DB queries. Will timeout at scale.

**Solution:** Batch the per-course queries using `Promise.all` across courses (not sequential). This reduces the round-trip count from `O(teachers * courses * 7)` to `O(teachers * 7)` since the per-course queries within each teacher run in parallel.

Full rewrite to batch queries is out of scope — this is the minimum viable fix to prevent timeouts.

**Files changed:**
- `pages/api/cron/daily.ts`

---

## Fix 12: Activity log action on group creation (M7)

**Problem:** `groups/create.ts` logs `member_joined` instead of a more appropriate action for group creation.

**Solution:** The `member_joined` action is technically correct (the creator is joining as the first member), but it's confusing in the Timeline. Add a second activity log entry for group creation: `group_created` action with meta containing the group name.

Note: `group_created` is not in the `ActivityAction` type. We do NOT add it — the activity log table stores text, and the Timeline component already has a fallback for unrecognized actions. Adding it to the type is a separate task.

**Wait — checking if `group_created` exists in the type...**

Looking at `types/index.ts:77-99`, the `ActivityAction` type does NOT include `group_created`. We should add it to keep TypeScript happy.

**Files changed:**
- `pages/api/groups/create.ts` — add `group_created` activity log entry
- `types/index.ts` — add `'group_created'` to `ActivityAction` union

---

## Fix 13: Sentry DSN startup validation (M3)

**Problem:** If `NEXT_PUBLIC_SENTRY_DSN` is missing, Sentry silently drops all events.

**Solution:** Add a console warning in both `sentry.client.config.ts` and `sentry.server.config.ts` when DSN is missing in production.

**Files changed:**
- `sentry.client.config.ts`
- `sentry.server.config.ts`

---

## Fix 14: `redirectTo` in forgot-password (L2)

**Problem:** `redirectTo` uses client-controlled `origin` header.

**Solution:** Hardcode using `process.env.NEXT_PUBLIC_SUPABASE_URL`... actually, the app URL is not in env vars. Use the Vercel `VERCEL_PROJECT_PRODUCTION_URL` or hardcode `https://joincontrib.com`.

Better: use a new env var `NEXT_PUBLIC_APP_URL` with fallback to `https://joincontrib.com`.

```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
const redirectTo = `${appUrl}/reset-password`;
```

**Files changed:**
- `pages/api/auth/forgot-password.ts`

---

## Fix 15: Add `lead_transferred` and `member_added` to `NotificationType` (type gap)

**Problem:** API routes send notifications with types not in the `NotificationType` union. TypeScript doesn't catch this because Supabase client types are looser.

**Solution:** Add `'lead_transferred'` and `'member_added'` to the `NotificationType` union.

**Files changed:**
- `types/index.ts` — update `NotificationType`

---

## Out of Scope (noted for future)

- DB-level `ON DELETE CASCADE` constraints (requires migration)
- DB-level max-6-member constraint (M5, requires trigger/check)
- Page-level error boundary in `_app.tsx` (M1, separate task)
- API route test coverage (L1, separate initiative)
- Token entropy review (L3, acceptable as-is)
- Removing `invite_token` from course page requires a fetch-on-demand pattern for the teacher "Copy invite link" button — this needs a small dedicated API or the teacher course page fetches the token server-side via `getServerSideProps`. Deferred to avoid scope creep.

---

## File Change Summary

| File | Action |
|---|---|
| `lib/columns.ts` | New |
| `lib/validation.ts` | Edit (add onboard schema) |
| `hooks/use-tasks.ts` | Edit |
| `hooks/use-evidence.ts` | Edit |
| `hooks/use-task-comments.ts` | Edit |
| `hooks/use-course.ts` | Edit |
| `hooks/use-courses.ts` | Edit |
| `hooks/use-group.ts` | Edit |
| `next.config.ts` | Edit |
| `pages/api/courses/[id]/join.ts` | New |
| `pages/api/profile/onboard.ts` | New |
| `pages/join/course/[token].tsx` | Edit |
| `pages/onboarding.tsx` | Edit |
| `pages/api/groups/[id]/transfer-lead.ts` | Edit |
| `pages/api/auth/forgot-password.ts` | Edit |
| `pages/api/courses/[id]/delete.ts` | Edit |
| `pages/api/cron/daily.ts` | Edit |
| `pages/api/groups/create.ts` | Edit |
| `types/index.ts` | Edit |
| `sentry.client.config.ts` | Edit |
| `sentry.server.config.ts` | Edit |
| `vercel.json` | Edit |

**22 files total (3 new, 19 edits)**
