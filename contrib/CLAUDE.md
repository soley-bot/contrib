# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Post-launch hardening + polish complete. Shipped: security (CSP, rate limiting, RLS audit), UX polish (skeletons, toasts, ARIA), robustness (error boundaries, validation), shareable contribution records, role lock, color audit, teacher UX fixes. Next: teacher experience gaps (course analytics, cross-group comparison) and **Leap Sok meeting prep** (first real case study).

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

0. **Live users in production** — real users are active. Never run destructive DB operations (DROP, TRUNCATE, DELETE without WHERE, column removal). All migrations must be additive (add columns/tables, not remove). All schema changes must be backwards-compatible. Test locally first, never against production.
1. **Pages Router only** — no `app/`, `layout.tsx`, `use client`, `getServerSideProps` is correct here
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
- **Banned:** teal `#0E7490`, coral `#FF5841`, warm stone `#3A3632`
- **No gradients, no deep shadows** — flat design only

## Page Structure

```
pages/
  index.tsx              — landing (horizontal scroll storyboard)
  login.tsx / signup.tsx  — auth (confirm-password on signup)
  forgot-password.tsx / reset-password.tsx
  auth/callback.tsx       — OAuth callback
  onboarding.tsx          — new user setup
  dashboard.tsx           — student dashboard (getServerSideProps: requireStudent)
  profile.tsx             — user profile (getServerSideProps: requireAuth)
  group/[id].tsx          — student group (getServerSideProps: requireAuth)
  join/[token].tsx        — join group via invite
  join/course/[token].tsx — join course via teacher invite
  report/[token].tsx      — public shareable contribution record (no auth)
  teacher/index.tsx       — teacher dashboard (getServerSideProps: requireTeacher)
  teacher/course/[id]/index.tsx            — course detail
  teacher/course/[id]/group/[groupId].tsx  — group drill-down (read-only)
```

## Security Infrastructure (shipped)

- **Server-side auth**: `lib/supabase-server.ts` — `requireAuth()`, `requireStudent()`, `requireTeacher()` in `getServerSideProps`
- **Input validation**: `lib/validation.ts` — Zod schemas for signup, join, groups, tasks, evidence, evaluations, courses
- **Rate limiting**: `lib/rate-limit.ts` — in-memory, applied to API routes (signup: 5/min, lookup: 30/min)
- **Error boundary**: Sentry `withErrorBoundary` in `_app.tsx`
- **Toast provider**: `components/toast-provider.tsx` — shared context, auto-dismiss
- **RLS policies**: All 9 tables have RLS enabled, 6 additional policies from audit (teacher evidence read, member leave/remove, eval delete, group delete)
- **DB indexes**: 9 performance indexes on common query patterns
- **Report shares**: Time-limited tokens (default 7 days), public viewer at `/report/[token]` strips peer review scores
- **Role lock**: Users locked to chosen role after first meaningful action

## API Routes

- `POST /api/auth/signup` — rate-limited user registration (5/min)
- `GET  /api/join/lookup` — group invite token lookup (30/min)
- `GET  /api/report/lookup` — public report data, no auth (20/min)
- `*    /api/report/share` — create/get/delete shareable links (10/min)

## Key Types (`types/index.ts`)

Profile, Group, Task, Evidence, ActivityLog, Course, EvaluationSession, Evaluation, EvaluationSummary — see file for full shapes.

## What's Built

- **Student:** groups, tasks (kanban), evidence (immutable+versioned), timeline (realtime), peer review, PDF export (6 themes), task board skeletons, shareable contribution record links (time-limited, public), role lock after first action
- **Teacher:** courses, group list + progress, group drill-down (read-only), teacher-mode PDF with executive summary, role-based PDF export (student vs teacher sections)

## Z-Index Hierarchy

| Layer | Z-index |
|---|---|
| Content | default |
| Sticky tabs | `z-40` |
| Navigation | `z-50` |
| Modals | `z-[100]` |

## Coding Standards

### Always
- Check Supabase `error` and surface to user — never silent failures
- Show spinner/skeleton while loading — never `return null` or flash `0`
- Guard modals: disable backdrop click during async, `<form onSubmit>` for Enter key
- Double-submit prevention: `if (submitting) return` on every async handler
- Validate inputs with Zod before Supabase operations
- Type check: `npx tsc --noEmit` after multi-file changes

### Never
- Teal, coral, warm stone colors
- Old feature names (Activity, Evaluation, Export Report, Upload evidence)
- `return null` for missing data
- Hard delete on tasks or evidence
- App Router conventions in this Pages Router project

### Mobile
- Bottom elements: `calc(60px + env(safe-area-inset-bottom))`
- No duplicate components across tabs (e.g. InviteBanner)
- Touch handlers check for open modals

## Git Workflow

- `main` is always deployable — feature branches, rebase before merge
- Commit messages: short, imperative ("Add task modal", "Fix auth redirect")
- After merge: pull main, prune, delete local branch
- After conflicts: verify with `npm run build` before committing
- Worktree safety: always confirm active worktree path with `git rev-parse --show-toplevel` before writing any files
- When making git commits or PRs, always use the git assistant skill if available. Do not attempt manual git workflows unless the skill is unavailable

## Verification

- After making changes, always verify the app builds successfully with `npm run build` before claiming the task is done. Never say fixes are complete without verification
- Before fixing anything, diagnose the root cause first. Read the relevant files, check the error logs, and explain what's wrong. Only then propose a fix and verify it builds
- Run `npx tsc --noEmit` after multi-file changes

## Authentication

- When fixing auth flows (Google OAuth, PKCE, session persistence), always test the full login → callback → redirect → session chain. Auth race conditions have been a recurring issue
- Before starting auth work, run `git fetch origin && git merge origin/main` and resolve any conflicts to avoid divergence

## Dev Setup

```bash
cd contrib && npm install
# Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev  # localhost:3000
```

SQL migrations in `database/` — apply via Supabase dashboard.

## Business Model

- Students: free forever
- Teachers/institutions: pay for real-time monitoring + AI features (post-launch)
