# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## General Behavior

- After completing a task or when sub-agents finish, immediately continue working on the next item without waiting for the user to say 'continue'.
- When reporting task completion, verify claims are accurate. Do not say a fix is done unless the specific issue has been tested or the build confirms it.
- Always run `npm run build` after making changes to verify no TypeScript errors before committing. **No exceptions** — "looks right" is not verification.

## Diagnosing Auth / RLS / DB Bugs (read before proposing any fix)

The most expensive failure mode in this repo is jumping to a plausible-but-wrong root cause. Before proposing ANY auth, RLS, or DB fix:

1. **Read the actual current state.** Query live RLS policies via the Supabase MCP (`mcp__claude_ai_Supabase__execute_sql` against `pg_policies`) or read `database/rls-policies-live.sql`. Do not guess from memory.
2. **Verify "typos" are actually typos.** Before claiming a function name is wrong, grep the codebase AND query `pg_proc` for it. `user_is_group_member`, `user_is_course_teacher`, etc. are real SECURITY DEFINER functions — not typos.
3. **State the root cause in one sentence with file:line evidence** before writing a fix. If you can't, you don't understand the bug yet — keep investigating.
4. **Reproduce with the anon key**, not service role. Service role bypasses RLS and hides the actual bug.

This rule exists because of past incidents: `user_is_group_member` was misdiagnosed as a typo when it was a real function; the actual fix was a missing course-ownership check in the SELECT policy. Don't repeat that.

## Current Priority

Pilot running with 2–3 pilot teachers on `joincontrib.com`. Product positioning is **student-first with teacher as opt-in layer** (shipped in the student-first reframe, 2026-04-06). North-star metric: of students who sign up this week, how many invite at least one teammate to a group within 48 hours. Next-up work is Phase 2 UX (Getting Started checklists, "What's next?" banners, invite-link CTA treatment) — the items most likely to move the north-star metric.

## Tech Stack

Next.js **Pages Router** (NOT App Router) · Supabase (Postgres + Auth + RLS) · Vercel · Sentry · Zod · TypeScript · Tailwind CSS v4 · jsPDF

## Core Constraints (never break these)

0. **Live users in production** — no destructive DB ops. Migrations additive only.
1. **Pages Router only** — no `app/`, `layout.tsx`, `use client`
2. **Evidence is immutable** — versioning only (`version_number`)
3. **Soft delete tasks** — `deleted_at`, never hard delete
4. **No emojis** — SVG icons only (`components/icons.tsx`)
5. **Peer review scores anonymous** — averages only
6. **Framing = empowerment** — "log your work" not "upload evidence"

## Feature Names (locked)

Timeline (not Activity) · Peer Review (not Evaluation) · Export Contribution Record (not Export PDF) · Log your work (not Upload evidence)

## Color System (locked)

Brand: `#1A56E8` · Hover: `#1240C4` · Light: `#EBF0FF` · Background: `#F8FAFF` · Text: `#0F172A`
**Banned:** teal, coral, warm stone, gradients, deep shadows

## Pages

```
pages/
  index.tsx                — landing page
  login.tsx / signup.tsx   — auth
  forgot-password.tsx / reset-password.tsx
  auth/callback.tsx        — OAuth callback
  onboarding.tsx           — new user setup (redirects away if profile exists)
  dashboard.tsx            — student dashboard
  profile.tsx              — user profile + Telegram + notification preferences
  group/[id].tsx           — student group view (~900 lines)
  join/[token].tsx         — join group via invite
  join/course/[token].tsx  — join course via invite
  report/[token].tsx       — public contribution record (no auth)
  privacy.tsx / terms.tsx  — legal pages
  404.tsx                  — custom not found
  teacher/index.tsx        — teacher dashboard
  teacher/course/[id]/index.tsx            — course detail
  teacher/course/[id]/group/[groupId].tsx  — group drill-down (read-only)
```

## API Routes (28)

| Route | Method | Auth |
|---|---|---|
| `/api/auth/signup` | POST | None (5/min) |
| `/api/auth/forgot-password` | POST | None (10/min) |
| `/api/join/lookup` | GET | None (30/min) |
| `/api/report/lookup` | GET | None (20/min) |
| `/api/report/share` | GET/POST/DELETE | Required (10/min) |
| `/api/groups/[id]/blockers` | POST | Required |
| `/api/groups/create` | POST | Required |
| `/api/groups/[id]/join` | POST | Required (student) |
| `/api/groups/[id]/add-member` | POST | Required (teacher/lead) |
| `/api/groups/[id]/remove-member` | POST | Required (teacher) |
| `/api/groups/[id]/eligible-members` | GET | Required (teacher/lead) |
| `/api/groups/[id]/reset-invite` | POST | Required (lead) |
| `/api/groups/[id]/archive` | POST | Required (lead or teacher) |
| `/api/groups/[id]/edit` | POST | Required (lead or teacher) |
| `/api/groups/[id]/transfer-lead` | POST | Required (lead) |
| `/api/courses/[id]/join` | POST | Required (student, 10/min) |
| `/api/courses/[id]/leave` | POST | Required (student) |
| `/api/courses/[id]/reset-invite` | POST | Required (teacher) |
| `/api/courses/[id]/delete` | DELETE | Required (teacher) |
| `/api/profile/onboard` | POST | Required (5/min) |
| `/api/profile/role` | POST | Required (5/min) |
| `/api/notify` | POST | Required |
| `/api/evidence/create` | POST | Required (multipart, 4 MB cap) |
| `/api/evidence/download-url` | GET | Required (member or course teacher; 404 unified) |
| `/api/telegram/connect` | POST | Required |
| `/api/telegram/disconnect` | POST | Required |
| `/api/telegram/webhook` | POST | Webhook secret |
| `/api/telegram/setup` | GET | Secret param |
| `/api/cron/daily` | GET/POST | CRON_SECRET |

## Database (15 tables)

`profiles` · `groups` · `group_members` · `tasks` · `evidence` · `task_comments` · `activity_log` · `courses` · `course_members` · `evaluation_sessions` · `evaluations` · `blocker_declarations` · `telegram_subscriptions` · `report_shares` · `notifications`

All tables have RLS. Profiles SELECT restricted to relevant users (co-members, course peers). Courses SELECT restricted to teacher + enrolled members.

### Evidence columns (since 2026-04-19)

Beyond `id, task_id, uploaded_by, type, content, version_number, deleted_at, created_at`, the `evidence` table also has `file_path | null`, `file_name | null`, `file_size | null`, `mime_type | null`. These are populated when an uploaded file (not a URL) is stored. Legacy URL-based `type='file'` rows keep `file_path = NULL`.

Any hook or route that SELECTs evidence MUST include all four new columns explicitly, otherwise `as unknown as Evidence[]` casts will silently strand them as `undefined` and the UI will fall back to the legacy hyperlink renderer (known past footgun). Call sites: `hooks/use-evidence.ts`, `hooks/use-group-evidence.ts`, `pages/teacher/course/[id]/index.tsx` (PDF-prep query).

### Storage buckets

- `evidence` — private. Object key: `{group_id}/{task_id}/{evidence_id}-{sanitized_filename}`. RLS policies enforce group-member insert/read and course-teacher read. No UPDATE or DELETE policies (evidence immutability). The policy expressions use `storage.foldername(objects.name)[1]` — the `objects.` qualifier is required (unqualified `name` collides with `groups.name` in the teacher subquery).

### Database Change Rules (never skip these)

1. **Single source of truth:** `database/rls-policies-live.sql` is the canonical reference for all RLS policies. Every policy change MUST update this file.
2. **Verify after applying:** After running any SQL migration, query `pg_policies` to confirm the change took effect. Never assume a migration succeeded.
3. **RLS helper functions:** `user_is_group_member()` and `user_is_course_teacher()` are SECURITY DEFINER functions that bypass RLS to prevent recursion. No aliases.
4. **No scattered migration files:** Old files in `database/` are historical. New changes go in a dated file AND update `rls-policies-live.sql`.
5. **Multi-table mutations need all inserts:** When creating a group, ALWAYS insert into both `groups` AND `group_members` (+ `activity_log`). This applies to both student and teacher flows.
6. **Course-group linkage:** When creating a group linked to a course, ensure the creator is also in `course_members` (upsert).
7. **Teacher visibility pattern:** Every table that teachers need to read MUST have a SELECT policy with the course ownership check: `EXISTS (SELECT 1 FROM groups g JOIN courses c ON c.id = g.course_id WHERE g.id = <table>.group_id AND c.teacher_id = auth.uid())`.
8. **No cross-table RLS without SECURITY DEFINER:** When an RLS policy on table A does `EXISTS (SELECT FROM table B)`, and table B's RLS does `EXISTS (SELECT FROM table A)`, PostgreSQL enters infinite recursion → 500 errors. Always use a SECURITY DEFINER function to break the cycle. Current pairs that need this: `groups`↔`group_members` (via `user_is_group_member`), `courses`↔`course_members` (via `user_is_course_teacher`).
9. **Test RLS changes with anon key:** After modifying RLS policies, verify with a curl using the anon key (not service role) to catch recursion or permission errors that bypass-RLS queries hide.

## What's Built

- **Student:** groups, tasks (kanban + 5 contribution types), evidence (immutable+versioned; real file upload via `/api/evidence/create` + Supabase Storage `evidence` bucket, or legacy URL/note), task comments, timeline (realtime), peer review, PDF export (6 themes), shareable reports (30-day expiry), blocker declarations, in-app + Telegram notifications, course enrollment
- **Teacher:** courses, group creation (auto-transfers lead to first student), group list + progress, drill-down (read-only), course analytics, ungrouped students, course deletion (cascade)
- **Platform:** notification preferences (4 toggles), error boundary, custom 404, privacy/terms pages, CI/CD (GitHub Actions), Upstash Redis rate limiting
- **Real-time:** tasks, activity_log, group_members, evaluations, evidence, task_comments, courses, notifications
- **Telegram:** 6 notification types, /start and /help commands, long message splitting (4096 char limit)

## Course Invite Flows

**Flow 1 (student-driven):** Teacher creates course → shares link → student joins → creates group → invites members

**Flow 2 (teacher-driven):** Teacher creates group in course → picks student lead from enrolled roster → shares group link → students join

**Flow 3 (direct add):** Teacher assigns ungrouped students to groups from course page, or group lead adds enrolled students via "Add from course" button

## Shared Modules

| Module | Key exports |
|---|---|
| `lib/supabase-admin.ts` | `adminClient` (service-role, bypasses RLS) |
| `lib/supabase-server.ts` | `getUserFromApiRoute`, `createServerClient`, `requireAuth`, `requireStudent`, `requireTeacher` |
| `lib/supabase.ts` | `supabase` (client-side, respects RLS) |
| `lib/rate-limit.ts` | `rateLimit` (async, Upstash Redis), `RATE_LIMITS`, `getClientIp` |
| `lib/validation.ts` | Zod schemas for all inputs |
| `lib/notify.ts` | `notifyGroupMembers(groupId, text, type, excludeId)` |
| `lib/telegram.ts` | `sendTelegramMessage(chatId, text)` |
| `lib/evidence-upload.ts` | `sanitizeFilename`, `buildObjectKey`, `MAX_FILE_BYTES`, `ALLOWED_MIME_TYPES` |
| `types/index.ts` | `Profile`, `Group`, `Task`, `Evidence`, `TaskComment`, `ActivityLog`, `Course`, etc. |

## API Route Template

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`route:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window)))
    return res.status(429).json({ error: 'Too many requests.' });
  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });
  // Validate with Zod → DB operation with adminClient → respond LAST
}
```

## Coding Standards

### Always
- `await rateLimit()` — it's async (Upstash Redis)
- Check Supabase `error` and surface to user
- Spinner/skeleton while loading — never blank screens
- Guard modals: disable backdrop click during async
- `useRef` for double-submit prevention (not just state)
- Validate inputs with Zod before Supabase
- `npx tsc --noEmit` after multi-file changes
- Sentry for errors, not console
- Changelog entry for user-facing features (`components/whats-new.tsx`)
- Use `PROFILE_SELECT` from `lib/columns.ts` for profile joins — never `profiles(*)`
- All DB mutations go through API routes — never `supabase.from(...).insert/update/delete()` client-side
- Hook select columns must match their TypeScript interface — if the type says `field: string`, the select must include `field`

### Never
- Direct `EXISTS (SELECT FROM tableB)` in RLS when tableB's RLS references back — use SECURITY DEFINER
- Banned colors (teal, coral, warm stone) or gradients
- Old feature names (Activity, Evaluation, Export Report, Upload evidence)
- Hard delete tasks or evidence
- App Router conventions (`use client`, `app/`, `layout.tsx`)
- `res.end()` before async work in API routes
- Copy-paste `adminClient`, `getUser()`, or rate limit numbers
- `console.error` in API routes
- `select('*')` in hooks — use explicit columns to avoid leaking `invite_token`
- Client-side `supabase.from().insert/update/delete()` for mutations — always use an API route with rate limiting, Zod validation, and role checks
- `as Type[]` cast on Supabase results when the select doesn't include all required fields — the cast hides runtime `undefined` values

## Git & Deployment

- `main` is always deployable · Domain: `joincontrib.com`
- CI: GitHub Actions (type check → vitest → build) on push/PR to main
- Verify with `npm run build` before claiming done
- Worktree safety: confirm path with `git rev-parse --show-toplevel`
- When resolving merge conflicts, always verify the build passes (`npm run build` or `npx tsc --noEmit`) after resolution before reporting completion
- Fluid Compute: should be enabled in Vercel dashboard (Project → Settings → Functions). Default on for Next.js 16 projects — reuses function instances across concurrent requests, significantly reducing API route cold starts. Confirm if you ever see unusually slow first-request latency.

## File Structure

- When making changes, always work in the correct directory. Verify file paths before writing.
- The main app source is in `contrib/` under the project root's standard Next.js Pages Router structure.

## Dev Setup

```bash
cd contrib && npm install
# .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
# SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
# KV_REST_API_URL, KV_REST_API_TOKEN
npm run dev
```

- Do not start a new dev server if one is already running on port 3000. Check with `lsof -i :3000` or equivalent before attempting to start one.

## Cron Job

`pages/api/cron/daily.ts` · `30 0 * * *` (7:30 AM Cambodia) · Deadline reminders (daily) + Teacher digest (Mondays) · Auth: `CRON_SECRET` · Config: `vercel.json`

## Deferred Work

- Email notifications (fallback for Telegram)
- Mobile PWA
- Task templates
- Bulk group creation (CSV)
- Feature spotlight tour
- Dedicated changelog page
- LMS integration (Google Classroom)
- Role-lock TOCTOU hardening: `/api/profile/role` and similar check-then-update endpoints (`use-role-lock.ts` pattern) are not atomic. Low severity — self-race only, RLS does not gate on `profile.role` so no data leak. Fix requires a shared `SECURITY DEFINER` SQL function + sweep of all role-locked routes. Revisit at ~50 active users or on first Sentry report of role-state inconsistency.
- Link existing standalone group to a course (retroactive teacher adoption): lets a student who created a standalone group later attach it to a teacher's course via a course invite token. Not urgent — pilot teachers are already using Contrib so students start groups inside courses, not standalone. Build when you see viral adoption signals (student asks "how do I show my teacher what we've done?" or a teacher signs up because a student told them to). Short-term substitute: `/api/report/share` 30-day link already works as a read-only teacher view.
- Phase 2 cache work: DONE (2026-04-20). All 22 read hooks in `hooks/` migrated to SWR (plan: `docs/superpowers/plans/2026-04-06-cache-and-cold-start.md`). Skipped: `use-create-course` (mutation-only, no read) and `use-share-link` (API-route-based). Next perf lever: populate `getServerSideProps` on dashboard/group pages with SWR `fallbackData` for zero-flash first paint, or combine `useGroups`+`useDashboardSummary` into a single RPC to kill the two-step waterfall.
- SWR cache leak on soft-navigation sign-out: Task 4 hooks (`use-groups`, `use-tasks`, `use-activity`, `use-dashboard-summary`) key off caller-provided IDs and are not cleared by `ProfileProvider` when `onAuthStateChange` fires `SIGNED_OUT`. Safe today because `components/nav-shell.tsx` signs out via `window.location.href = '/'` (hard reload, tears down the React tree). If sign-out is ever switched to a soft navigation (`router.push`), audit these hooks for stale-user-data exposure — fix is to call `mutate(() => true, undefined)` inside the provider's `SIGNED_OUT` branch to flush the SWR cache.
- Telegram push for `group_created_in_course` notification: in-app only today. Add Telegram delivery if teachers ask for it or if you find they are not checking the bell.
- Evidence `version_number` race: `/api/evidence/create` reads `MAX(version_number)` then inserts `+1`, so concurrent uploads to the same task can produce duplicate version numbers. No `UNIQUE (task_id, version_number)` constraint exists. Fix by adding the unique index and retrying on conflict, OR by computing the next version inside the INSERT statement. Low severity at current user count (no pilot teacher has >1 student uploading to the same task simultaneously).
- Evidence upload uses `fs.readFileSync` in `/api/evidence/create` (blocks the serverless event loop). Files cap at 4 MB so latency impact is small, but switching to `fs/promises.readFile` is a trivial win.
- Evidence upload size cap is 4 MB (Vercel Pages Router body limit). To allow larger files, switch to pre-signed direct-to-Storage uploads from the client. Adds a round-trip and an orphan-object edge case.
