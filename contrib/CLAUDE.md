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
- Blue tint: `#EBF0FF` (hover states, backgrounds)
- Off-white: `#F8FAFF` (page backgrounds)
- Slate: `#0F172A` (primary text)
- **Teal is gone** — do not use it anywhere
- **No gradients, no deep shadows** — flat design only

## Logo (The Record mark)

- SVG-based timeline spine with dots — bare SVG, no background container
- Blue strokes (`#1A56E8`) on white/light backgrounds
- Sizes: 28px (login/signup/landing), 24px (sidebar), 20px (mobile header)
- All instances are inline SVG — no imported image files
- Locations: `nav.tsx` (sidebar + mobile), `index.tsx`, `login.tsx`, `signup.tsx`

## Typography

- **Plus Jakarta Sans** — one typeface, all weights (loaded via Google Fonts in `_document.tsx`)
- Hierarchy through weight and size only, never through color variety

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

## Landing Page (completed)

Horizontal scroll-snap storyboard at `pages/index.tsx`. Spec at `docs/superpowers/specs/2026-03-22-landing-page-redesign.md`.

- **6 slides** — 5 narrative beats + CTA slide, full-viewport (`100dvh`), `scroll-snap-type: x mandatory`
- **2-column desktop** (text left `md:flex-1`, visual right `md:flex-[1.2]`), stacks `flex-col` on mobile
- **Inline SVG visuals** — custom mockups (chat window, kanban, timeline, peer review, PDF), no background images
- **Storyset illustrations** deleted — were 452KB of animated SVGs causing flickering, replaced by lightweight inline visuals
- **Auto-hide nav** — `group/nav` with `-translate-y-full group-hover/nav:translate-y-0`, intentionally no mobile hover (storyboard IS the experience)
- **Mobile tap-edge navigation** — fixed 48px tap zones on left/right screen edges
- **Keyboard nav** — ArrowRight/Left and spacebar scroll between slides
- **Slide entrance animations** — opacity + translateY with staggered delays per element
- **Typography**: labels 11px bold uppercase tracking-[2.5px], titles `clamp(32px, 4.5vw, 52px)` extrabold, body 16px medium `#64748B`
- **All backgrounds off-white** (`#F8FAFF`) — dark backgrounds dropped after testing
- Auto-redirects signed-in users to dashboard/teacher page

## Launch Checklist

1. ~~**Landing page redesign**~~ — done (horizontal scroll storyboard, 10+ iterations)
2. ~~**Login/signup copy**~~ — done ("Your work is on record." / "Put your work on the record." / "Now in early access.")
3. ~~**Illustration accent colors**~~ — done (Storyset SVGs deleted, inline visuals use `#1A56E8`)
4. ~~**UX polish**~~ — done (cool slate palette migration, emoji removal, consistent sizing)
5. ~~**Bug fixes**~~ — done (25 issues fixed: error handling, loading states, swipe-through-modal, auth flows)
6. ~~**Auth edge cases**~~ — done (callback timeout, returnTo forwarding, reset-password loading state)
7. **Production readiness** — remaining: accessibility (ARIA labels), confirm-password field, teacher page teal cleanup

## Z-Index Hierarchy

| Layer | Z-index | Elements |
|---|---|---|
| Content | default | Cards, lists, forms |
| Sticky tab bar | `z-40` | Teacher group drill-down tabs |
| Navigation | `z-50` | Mobile header, desktop sidebar, mobile bottom nav |
| Modals | `z-[100]` | All modals and overlays |

## Brand Guidelines

Full brand bible at `../contrib-markting/contrib-brand-guidelines.html`. Key rules:
- No emojis — SVG icons only
- No teal — permanently removed
- No gradients or heavy shadows — flat design
- No surveillance framing — always empowerment
- Feature names are locked (see Feature Names table above)
- Voice: confident, direct, specific — not generic EdTech copy

## Coding Standards (enforced)

These rules exist because we found real bugs from violating them. Follow them on every new code.

### Supabase mutations — always check errors
```tsx
// WRONG — silent failure
await supabase.from('tasks').delete().eq('id', id);

// RIGHT — catch and surface to user
const { error } = await supabase.from('tasks').delete().eq('id', id);
if (error) { showToast('Failed to delete task.'); return; }
```

### Loading states — never show stale data
- Every page must show a spinner or skeleton while auth/data loads
- Never `return null` for missing data — show a spinner or redirect
- Stats/counts must not flash `0` before real data arrives — use a `loaded` flag
- `useGroups`/`useTasks` loading states must be checked before rendering dependent UI

### Modals — disable background interactions
- Swipe navigation, backdrop clicks, and keyboard shortcuts must be disabled when a modal is open
- Forms in modals must be wrapped in `<form onSubmit>` so Enter key works
- Backdrop click must be guarded during async operations (`if (!creating) setShowModal(false)`)

### Double-submit prevention
- Every async submit function needs an in-flight guard (`if (submitting) return`)
- Set guard before await, reset in `finally` block

### Colors — brand palette only
- Student UI: `#1A56E8` (brand), `#1240C4` (hover), `#EBF0FF` (light), `#93B4FF` (border)
- Never use: `#FF5841` (coral), `#FFF0EE`, `#FFCFC9`, `#C53678` (pink), `#0E7490` (teal)
- Never use: `#F9FAFB`, `#3A3632`, `#2C2927` (warm stone)
- Page backgrounds: always `#F8FAFF`, never `#F9FAFB` or `#FAFAF9`

### Auth flows
- Google OAuth must forward `returnTo` query param through the callback
- Auth callback must have a timeout (10s) with fallback UI — never hang forever
- Reset password must show a loading state before the Supabase event fires

### Mobile
- Fixed bottom elements must account for bottom nav height (`bottom: calc(60px + env(safe-area-inset-bottom))`)
- Don't render the same component (e.g. InviteBanner) on multiple tabs
- Document-level touch handlers must check for open modals before firing

### Feature names (locked)
- Use "Peer Review" everywhere — not "Evaluation", not "Review" alone
- Button text: "Submit Peer Review", "Open Peer Review"
- Section headers: "Review your teammates" (not "Evaluate")

## Avoid

- Teal anywhere — removed from brand
- Coral `#FF5841` anywhere — removed from brand
- Scope creep — every feature must answer: "does this make individual effort visible in group work?"
- Old feature names (Activity, Evaluation, Export Report, PDF Report, Upload evidence)
- Silent Supabase failures — always check `error` and surface it
- `return null` for missing data — always show a loading state

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

## Claude Model Usage

| Task | Model |
|---|---|
| Planning, brainstorming, architecture | Opus 4.6 |
| Writing code, implementing features | Sonnet 4.6 |
| Bug fixes, debugging, testing | Opus 4.6 |
| Light work (git descriptions, commit messages) | Haiku 4.5 |

## Business Model

- Students: free forever
- Teachers/institutions: pay for real-time monitoring + AI features (post-launch)
