# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Pre-production QA complete (P0-P3). Ready for public launch.

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

## API Routes (18)

| Route | Method | Auth |
|---|---|---|
| `/api/auth/signup` | POST | None (5/min) |
| `/api/auth/forgot-password` | POST | None (10/min) |
| `/api/join/lookup` | GET | None (30/min) |
| `/api/report/lookup` | GET | None (20/min) |
| `/api/report/share` | GET/POST/DELETE | Required (10/min) |
| `/api/groups/[id]/blockers` | POST | Required |
| `/api/groups/[id]/reset-invite` | POST | Required (lead) |
| `/api/groups/[id]/auto-transfer-lead` | POST | Required |
| `/api/groups/[id]/archive` | POST | Required (lead) |
| `/api/groups/[id]/transfer-lead` | POST | Required (lead) |
| `/api/courses/[id]/reset-invite` | POST | Required (teacher) |
| `/api/courses/[id]/delete` | DELETE | Required (teacher) |
| `/api/notify` | POST | Required |
| `/api/telegram/connect` | POST | Required |
| `/api/telegram/disconnect` | POST | Required |
| `/api/telegram/webhook` | POST | Webhook secret |
| `/api/telegram/setup` | GET | Secret param |
| `/api/cron/daily` | GET/POST | CRON_SECRET |

## Database (15 tables)

`profiles` · `groups` · `group_members` · `tasks` · `evidence` · `task_comments` · `activity_log` · `courses` · `course_members` · `evaluation_sessions` · `evaluations` · `blocker_declarations` · `telegram_subscriptions` · `report_shares` · `notifications`

All tables have RLS. Known gaps: `profiles` SELECT overly broad, `courses` SELECT exposes invite tokens — fix before scaling.

## What's Built

- **Student:** groups, tasks (kanban + 5 contribution types), evidence (immutable+versioned), task comments, timeline (realtime), peer review, PDF export (6 themes), shareable reports (30-day expiry), blocker declarations, in-app + Telegram notifications, course enrollment
- **Teacher:** courses, group creation (auto-transfers lead to first student), group list + progress, drill-down (read-only), course analytics, ungrouped students, course deletion (cascade)
- **Platform:** notification preferences (4 toggles), error boundary, custom 404, privacy/terms pages, CI/CD (GitHub Actions), Upstash Redis rate limiting
- **Real-time:** tasks, activity_log, group_members, evaluations, evidence, task_comments, courses, notifications
- **Telegram:** 6 notification types, /start and /help commands, long message splitting (4096 char limit)

## Course Invite Flows

**Flow 1 (student-driven):** Teacher creates course → shares link → student joins → creates group → invites members

**Flow 2 (teacher-driven):** Teacher creates group in course (temp lead) → shares group link → first student joins → auto-becomes lead

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

### Never
- Banned colors (teal, coral, warm stone) or gradients
- Old feature names (Activity, Evaluation, Export Report, Upload evidence)
- Hard delete tasks or evidence
- App Router conventions (`use client`, `app/`, `layout.tsx`)
- `res.end()` before async work in API routes
- Copy-paste `adminClient`, `getUser()`, or rate limit numbers
- `console.error` in API routes
- `select('*')` in hooks — use explicit columns to avoid leaking `invite_token`

## Git & Deployment

- `main` is always deployable · Domain: `joincontrib.com`
- CI: GitHub Actions (type check → vitest → build) on push/PR to main
- Verify with `npm run build` before claiming done
- Worktree safety: confirm path with `git rev-parse --show-toplevel`

## Dev Setup

```bash
cd contrib && npm install
# .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
# SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
# KV_REST_API_URL, KV_REST_API_TOKEN
npm run dev
```

## Cron Job

`pages/api/cron/daily.ts` · `30 0 * * *` (7:30 AM Cambodia) · Deadline reminders (daily) + Teacher digest (Mondays) · Auth: `CRON_SECRET` · Config: `vercel.json`

## Deferred Work

- RLS tightening: profiles SELECT, courses SELECT (invite tokens)
- Email notifications (fallback for Telegram)
- Mobile PWA
- Task templates
- Bulk group creation (CSV)
- Feature spotlight tour
- Dedicated changelog page
- LMS integration (Google Classroom)
