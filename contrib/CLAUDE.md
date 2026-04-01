# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Phase 5 complete. Task comments shipped. Next: email notifications, mobile PWA.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js **Pages Router** (NOT App Router) |
| Backend/DB | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | Vercel |
| Monitoring | Sentry |
| Validation | Zod (`lib/validation.ts`) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| PDF | jsPDF |

## Core Constraints (never break these)

0. **Live users in production** — no destructive DB operations. All migrations additive and backwards-compatible.
1. **Pages Router only** — no `app/`, `layout.tsx`, `use client`. `getServerSideProps` is correct here.
2. **Evidence is immutable** — versioning only (`version_number`), never mutate or delete
3. **Soft delete tasks** — use `deleted_at`, never hard delete
4. **No emojis** — SVG icons only (`components/icons.tsx`)
5. **Peer review scores anonymous** — averages only (`EvaluationSummary`)
6. **Framing = empowerment** — "log your work" not "upload evidence"

## Feature Names (locked)

| Use This | Not This |
|---|---|
| Timeline | Activity |
| Peer Review | Evaluation |
| Export Contribution Record | Export PDF / Export Report |
| Log your work | Upload evidence |

## Color System (locked)

- Student: `#1A56E8` (brand), `#1240C4` (hover), `#EBF0FF` (light)
- Teacher: `#1240C4` (dark blue)
- Background: `#F8FAFF` (never `#F9FAFB`)
- Text: `#0F172A` (slate)
- **Banned:** teal, coral, warm stone — **No gradients, no deep shadows** — flat design only

## Page Structure

```
pages/
  index.tsx              — landing (horizontal scroll storyboard)
  login.tsx / signup.tsx  — auth (confirm-password on signup)
  forgot-password.tsx / reset-password.tsx
  auth/callback.tsx       — OAuth callback
  onboarding.tsx          — new user setup
  dashboard.tsx           — student dashboard (+ course memberships)
  profile.tsx             — user profile + Telegram connection
  group/[id].tsx          — student group view (largest page ~900 lines)
  join/[token].tsx        — join group via invite (auto-transfers lead from teacher)
  join/course/[token].tsx — join course via invite (enrolls in course_members)
  report/[token].tsx      — public shareable contribution record (no auth)
  teacher/index.tsx       — teacher dashboard
  teacher/course/[id]/index.tsx            — course detail + ungrouped students
  teacher/course/[id]/group/[groupId].tsx  — group drill-down (read-only)
```

## API Routes

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/auth/signup` | POST | Registration (5/min) | None |
| `/api/join/lookup` | GET | Group invite lookup (30/min) | None |
| `/api/report/lookup` | GET | Public report data (20/min) | None |
| `/api/report/share` | GET/POST/DELETE | Shareable links (10/min) | Required |
| `/api/groups/[id]/blockers` | POST | Declare blocker | Required |
| `/api/groups/[id]/reset-invite` | POST | Reset group invite | Required (lead) |
| `/api/groups/[id]/auto-transfer-lead` | POST | Transfer lead from teacher to student | Required |
| `/api/courses/[id]/reset-invite` | POST | Reset course invite | Required (teacher) |
| `/api/notify` | POST | Send Telegram notification to group | Required |
| `/api/telegram/connect` | POST | Generate verification code | Required |
| `/api/telegram/disconnect` | POST | Remove Telegram link | Required |
| `/api/telegram/webhook` | POST | Incoming Telegram messages | Webhook secret |
| `/api/telegram/setup` | GET | Register webhook (run once) | Secret param |

## Database (15 tables)

`profiles`, `groups`, `group_members`, `tasks`, `evidence`, `task_comments`, `activity_log`, `courses`, `course_members`, `evaluation_sessions`, `evaluations`, `blocker_declarations`, `telegram_subscriptions`, `report_shares`, `notifications`

Key details:
- `tasks.contribution_type`: `task | coordination | meeting | discussion | research`
- `telegram_subscriptions.chat_id`: nullable bigint (null when pending)
- `course_members`: tracks course enrollment before group assignment
- `task_comments`: flat discussion on tasks, soft delete via `deleted_at`, author + group lead can delete
- All tables have RLS enabled

## What's Built

- **Student:** groups, tasks (kanban + contribution types), evidence (immutable+versioned), task comments (flat discussion threads), timeline (realtime), peer review, PDF export (6 themes), shareable report links, blocker declarations, in-app + Telegram notifications, course enrollment
- **Teacher:** courses, group creation (auto-transfers lead to first student), group list + progress, drill-down (read-only), course analytics, ungrouped students view
- **Real-time:** tasks, activity_log, group_members, evaluation_sessions, evaluations, evidence, task_comments, courses, notifications
- **Telegram:** 6 notification types (task created, task reassigned, evidence logged, peer review opened, member joined, blocker declared). Bot responds to /start, /help, and non-code messages.

## Course Invite Flows

**Flow 1 (student-driven):** Teacher creates course → shares invite link → student joins course → student creates group inside course from dashboard → group lead invites members

**Flow 2 (teacher-driven):** Teacher creates course → creates group in course (teacher = temp lead) → copies group invite link → first student who joins auto-becomes lead (teacher removed from group_members)

## Shared Types & Constants (`types/index.ts`)

`Profile`, `Group`, `Task`, `Evidence`, `TaskComment`, `ActivityLog`, `Course`, `CourseMember`, `EvaluationSession`, `Evaluation`, `EvaluationSummary`, `EvaluationInsert`, `CONTRIBUTION_TYPES`

## Security

- **Auth:** `lib/supabase-server.ts` — `requireAuth()`, `requireStudent()`, `requireTeacher()`. All API routes use `getUser()` (not `getSession()`).
- **Validation:** Zod schemas for all user inputs
- **Rate limiting:** In-memory (`lib/rate-limit.ts`) — adequate for current scale, migrate to Upstash Redis before scaling
- **RLS:** All 15 tables. Known gaps: `profiles` SELECT is overly broad, `courses` SELECT exposes invite tokens, `notifications` INSERT is too permissive — fix before scaling.
- **CSP:** Defined in `next.config.ts` only (removed from `vercel.json`)

## Telegram Bot

One-way notification bot (`@contrib_notify_bot`). Setup guide: `database/TELEGRAM-SETUP.md`

- `lib/telegram.ts` — `sendTelegramMessage`, `getBotUsername`, `setWebhook`
- `lib/notify.ts` — `notifyGroupMembers(groupId, text, type, excludeId)` — respects `notify_*` preference columns
- `pages/api/notify.ts` — client-callable endpoint for Telegram notifications (auth + group membership verified)
- Webhook registered at `joincontrib.com/api/telegram/webhook`

## Writing API Routes

Every API route follows this structure. **Never** copy-paste boilerplate — use the shared helpers.

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';           // server-side Supabase (bypasses RLS)
import { getUserFromApiRoute } from '@/lib/supabase-server';   // auth from cookie
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit
  const ip = getClientIp(req.headers);
  if (!rateLimit(`route:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  // Auth
  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  // Validate input (Zod)
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // DB operation (use adminClient)
  const { data, error } = await adminClient.from('table').insert({ ... });
  if (error) {
    Sentry.captureMessage(`[route] error: ${error.message}`, { level: 'error', tags: { route: 'name' } });
    return res.status(500).json({ error: 'Failed.' });
  }

  // Respond LAST — never res.end() before async work (Vercel kills the function)
  return res.status(200).json({ ok: true });
}
```

### Shared modules

| Module | Export | Purpose |
|---|---|---|
| `lib/supabase-admin.ts` | `adminClient` | Service-role Supabase client (bypasses RLS) |
| `lib/supabase-server.ts` | `getUserFromApiRoute(req, res)` | Extract authenticated user from API route cookies |
| `lib/supabase-server.ts` | `createServerClient(ctx)` | Supabase client for `getServerSideProps` |
| `lib/supabase.ts` | `supabase` | Client-side Supabase (respects RLS) |
| `lib/rate-limit.ts` | `rateLimit(key, limit, window)` | In-memory rate limiter |
| `lib/rate-limit.ts` | `RATE_LIMITS` | Named constants (`SIGNUP`, `JOIN_LOOKUP`, `REPORT_LOOKUP`, `REPORT_SHARE`, `DEFAULT`) |
| `lib/rate-limit.ts` | `getClientIp(headers)` | Extract client IP from request headers |
| `lib/validation.ts` | Zod schemas | Input validation for all user inputs |
| `lib/notify.ts` | `notifyGroupMembers(groupId, text, type, excludeId)` | Send Telegram to group members |
| `lib/telegram.ts` | `sendTelegramMessage(chatId, text)` | Send a single Telegram message |

### Rules for API routes
- **Never** create a local `adminClient` — import from `lib/supabase-admin`
- **Never** create a local `getUser()` function — import `getUserFromApiRoute` from `lib/supabase-server`
- **Never** hardcode rate limit numbers — use `RATE_LIMITS` constants
- **Never** use `console.error` — use `Sentry.captureException` or `Sentry.captureMessage`
- **Never** call `res.end()` before all async work completes
- **Always** validate inputs with Zod before DB operations
- **Always** check Supabase `error` and return appropriate HTTP status

### Client-side Telegram notifications

Client components can't call `notifyGroupMembers` directly (needs server-side secrets). Use the `/api/notify` endpoint:

```ts
fetch('/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ groupId, message: 'Your message', type: 'contributions' }),
}).catch(() => {});
```

## Verification

- After making changes, do NOT claim they are fixed without verifying via `npx tsc --noEmit` and `npm run build`. If browser preview tools fail, use `curl` or check compiled output.
- Always run `npx tsc --noEmit` after making changes to catch type errors before committing
- Never say "done" until the build passes

## Interaction Preferences

- When the user says "continue" or "yes", resume the most recent task without asking for clarification
- Do not ask what they mean — just keep going

## Debugging Priorities

- For auth flow debugging (OAuth, PKCE, session persistence): always check the callback page logic, CSP headers, and race conditions in that order before exploring tangential issues
- For UI bugs: verify the fix in the compiled output, not just the source code

## Coding Standards

### Always
- Check Supabase `error` and surface to user — never silent failures
- Show spinner/skeleton while loading — never `return null` for missing data
- Guard modals: disable backdrop click during async, `<form onSubmit>` for Enter key
- Double-submit prevention on every async handler
- Validate inputs with Zod before Supabase
- Type check: `npx tsc --noEmit` after multi-file changes
- Use shared helpers (`adminClient`, `getUserFromApiRoute`, `RATE_LIMITS`)
- Log errors to Sentry, not console
- Use CSS classes from `globals.css` for animations (`animate-slide-up`, `shadow-dropdown`)

### Never
- Teal, coral, warm stone colors
- Old feature names (Activity, Evaluation, Export Report, Upload evidence)
- Hard delete on tasks or evidence
- App Router conventions in this Pages Router project
- `res.end()` before async work in API routes (Vercel kills the function)
- Copy-paste `adminClient`, `getUser()`, or rate limit numbers into new files
- `console.error` in API routes (use Sentry)
- Inline `style={{ animation }}` or `style={{ boxShadow }}` (use CSS classes)
- Ship a user-facing feature without adding it to the `CHANGELOG` array in `components/whats-new.tsx`

## Role-Based Architecture

- **Pages:** `pages/teacher/*` for teacher, `pages/` root for student
- **Components:** Split by role if needed — never `if (role === 'teacher')` in shared components
- **Service/utility functions:** Shared is fine

## Git & Deployment

- `main` is always deployable. Domain: `joincontrib.com`
- Verify with `npm run build` before claiming done
- Worktree safety: confirm path with `git rev-parse --show-toplevel`
- After deploy: webhook auto-registered (no manual setup needed)
- When resolving merge conflicts, always verify the build passes (`npm run build` and `npx tsc --noEmit`) after resolution before reporting completion
- When working in git worktrees, always verify the current working directory before writing files. Use `pwd` and check against the expected worktree path. Never write to the main repo directory when a worktree is active

## Dev Setup

```bash
cd contrib && npm install
# .env.local needs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
npm run dev  # localhost:3000
```

## Business Model

- Students: free forever
- Teachers/institutions: pay for real-time monitoring + AI features (post-launch)

## What's New Changelog

When shipping any user-facing feature, add an entry to the `CHANGELOG` array in `components/whats-new.tsx`. Bump the `version` number. Users see a blue dot on the star icon in the nav until they open the dropdown.

## Cron Job

- **Route:** `pages/api/cron/daily.ts`
- **Schedule:** `30 0 * * *` (7:30 AM Cambodia time daily)
- **Jobs:** Deadline reminders (daily), Teacher weekly digest (Mondays only)
- **Auth:** `CRON_SECRET` header (Vercel auto-provisions)
- **Config:** `vercel.json` → `crons` array

## Deferred Work

- Rate limiting → Upstash Redis (before scaling)
- RLS tightening: profiles, courses, notifications tables
- Email notifications (fallback for users without Telegram)
- Mobile PWA (manifest + service worker + offline caching)
- Task templates (pre-built task sets for common project types)
- Bulk group creation for teachers (CSV upload)
- Feature spotlight tour (guided walkthrough for new users)
- Dedicated changelog page (currently nav dropdown only)
- LMS integration (Google Classroom roster import)
