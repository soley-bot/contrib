# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Post-launch hardening complete. All 3 phases shipped (security, UX polish, robustness). Next: Phase 4 growth features (email notifications, teacher onboarding, course analytics, paid tier).

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

## Key Types (`types/index.ts`)

Profile, Group, Task, Evidence, ActivityLog, Course, EvaluationSession, Evaluation, EvaluationSummary — see file for full shapes.

## What's Built

- **Student:** groups, tasks (kanban), evidence (immutable+versioned), timeline (realtime), peer review, PDF export, task board skeletons
- **Teacher:** courses, group list + progress, group drill-down (read-only), Contribution Record export

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
- Worktree safety: confirm correct working directory before writing

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
