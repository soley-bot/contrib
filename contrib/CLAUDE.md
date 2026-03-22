# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Polish & launch prep — targeting **April 1, 2026** release. Focus on UX polish, bug fixes, auth edge cases, and production readiness. Both student and teacher flows are functionally complete.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js **Pages Router** (NOT App Router) |
| Backend/DB | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| PDF | jsPDF |

## Core Constraints (never break these)

1. **Pages Router only** — never use App Router conventions (`app/`, `layout.tsx`, `use client`, etc.)
2. **Evidence is immutable** — versioning only (`version_number`), never mutate or delete uploads
3. **Soft delete tasks** — use `deleted_at`, never hard delete
4. **No emojis** — SVG icons only (all in `components/icons.tsx`)
5. **PDF mirrors Cambodian peer eval forms** — familiarity is a feature
6. **Peer review scores are anonymous** — show averages only (`EvaluationSummary`), never individual scores
7. **Framing = empowerment** — "log your work" not "upload evidence"

## Feature Names (locked)

| Use This | Not This |
|---|---|
| Timeline | Activity |
| Peer Review | Evaluation |
| Export Contribution Record | Export PDF / Export Report |
| Contribution Record | PDF Report / Report |
| Log your work | Upload evidence |

## Color System (locked)

- Student pages: `#1A56E8` (brand blue)
- Teacher pages: `#1240C4` (dark blue)
- **Teal is gone** — do not use it anywhere

## Page Structure

```
pages/
  index.tsx                          — landing page
  login.tsx / signup.tsx             — auth
  forgot-password.tsx / reset-password.tsx
  auth/callback.tsx                  — OAuth callback
  onboarding.tsx                     — new user setup (role, university, etc.)
  dashboard.tsx                      — student dashboard
  profile.tsx                        — user profile
  group/[id].tsx                     — student group detail (tasks, timeline, peer review, PDF export)
  join/[token].tsx                   — join a group via invite link
  join/course/[token].tsx            — join a course via teacher invite
  teacher/index.tsx                  — teacher dashboard (list of courses)
  teacher/course/[id]/index.tsx      — course detail (group list with progress, analytics)
  teacher/course/[id]/group/[groupId].tsx  — group drill-down (read-only: tasks, timeline, members, peer review)
```

## Key Components

```
components/
  icons.tsx              — all SVG icons (single source of truth)
  nav.tsx                — top nav (role-aware, student/teacher)
  task-card.tsx          — kanban task card
  task-modal.tsx         — task detail modal
  evidence-form.tsx      — log work / add evidence
  evaluation-form.tsx    — peer review submission form
  evaluation-results.tsx — peer review averages display
  confirm-modal.tsx      — generic confirm dialog
```
Run `ls components/` for the full list.

## Key Hooks

```
hooks/
  use-user.ts               — current user + profile, role detection
  use-group.ts              — single group + members
  use-tasks.ts              — tasks for a group (filters deleted_at)
  use-evidence.ts           — evidence for a single task
  use-evaluation.ts         — peer review submission state
  use-evaluation-session.ts — whether peer review is open for a group
  use-course.ts             — single course
```
Run `ls hooks/` for the full list.

## Key Types (`types/index.ts`)

- `Profile` — id, name, university, faculty, year_of_study, role (`student` | `teacher`)
- `Group` — id, name, subject, due_date, lead_id, invite_token, course_id
- `Task` — id, title, assignee_id, status (`todo` | `inprogress` | `done`), deleted_at
- `Evidence` — id, task_id, type (`file` | `link` | `note`), content, version_number
- `ActivityLog` — id, group_id, actor_id, action (typed union), meta
- `Course` — id, name, subject, teacher_id, invite_token
- `EvaluationSession` — id, group_id, opened_by, opened_at
- `Evaluation` — evaluator_id, evaluatee_id, contribution_score, collaboration_score
- `EvaluationSummary` — avg_contribution, avg_collaboration, eval_count, comments

## What's Built

- **Student side:** group creation/join, task management, evidence upload (immutable + versioned), timeline, peer review, Contribution Record PDF export
- **Teacher side:** course creation, course detail with group list + progress bars + analytics, group drill-down (read-only view of tasks/timeline/members/peer review), edit/delete course & group, copy invite links, download Contribution Record

## Launch Checklist

1. **UX polish** — smooth out rough edges across student and teacher flows
2. **Bug fixes** — resolve known issues before real users hit them
3. **Auth edge cases** — handle all login/signup/OAuth flows reliably
4. **Production readiness** — error states, loading states, empty states, mobile responsiveness

## Avoid

- Teal anywhere — removed from brand
- Scope creep — every feature must answer: "does this make individual effort visible in group work?"

## Git Workflow

- **`main` is always deployable** — never commit broken code directly to main
- **Feature branches** — create a branch for each feature or fix, PR into main, delete after merge
- **Clean history** — rebase feature branches on main before merging to keep history linear
- **Delete merged branches** — local and remote, immediately after merge. No stale branches.
- **Commit messages** — short, imperative ("Add task modal", "Fix auth redirect"), no prefixes like "feat:" unless asked
- **One concern per commit** — don't mix unrelated changes in a single commit
- **Always pull before branching** — `git pull origin main` before creating a new branch
- **After merging a PR** — pull main, prune remote refs (`git fetch --prune`), delete local branch

## Dev Setup

1. `cd contrib && npm install`
2. Ensure `.env.local` exists with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. `npm run dev` → runs on localhost:3000

SQL migrations are in `database/` — apply via Supabase dashboard or CLI.

## Business Model

- Students: free forever
- Teachers/institutions: pay for real-time monitoring + AI features (post-launch)
