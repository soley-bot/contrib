# Contrib — Claude Context

Individual effort is invisible in group work. Contrib turns it on.

## Current Priority

Teacher experience — getting one teacher to run a real assignment through Contrib as a case study. Upcoming meeting with Leap Sok (founder of Sala, leading Cambodian EdTech). Next build focus: course-level analytics for teachers.

Current active branch: `feature/bug-fixes-and-profile-page`

## Recently Shipped

- Profile page (`/profile`) with edit modal
- Realtime subscriptions on group/task data
- Teacher improvements: edit/delete course & group, analytics on course detail page
- Teacher group drill-down page (`/teacher/course/[id]/group/[groupId]`) — read-only view of tasks, timeline, members, peer review
- RLS recursion fix, mobile nav fix
- Security hardening (7 vulnerabilities fixed across auth, RLS, input validation)
- Google OAuth onboarding fix
- Peer evaluation system
- PDF export with theme color picker

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

## Component Map

```
components/
  icons.tsx              — all SVG icons (single source of truth)
  nav.tsx                — top nav (role-aware)
  task-card.tsx          — kanban task card
  task-form.tsx          — create task form
  task-modal.tsx         — task detail modal
  edit-task-modal.tsx    — edit task
  evidence-form.tsx      — log work / add evidence
  evidence-list.tsx      — list of evidence for a task
  evaluation-form.tsx    — peer review submission form
  evaluation-results.tsx — peer review averages display
  feed-item.tsx          — single timeline event
  member-row.tsx         — group member row
  course-card.tsx        — teacher course card
  course-group-row.tsx   — group row in teacher course page
  progress-bar.tsx       — task completion bar
  invite-banner.tsx      — group invite prompt
  role-toggle.tsx        — student/teacher role switcher
  confirm-modal.tsx      — generic confirm dialog
  edit-group-modal.tsx   — edit group name/subject/due date
  edit-profile-modal.tsx — edit user profile
  transfer-lead-modal.tsx — transfer group lead
```

## Hook Map

```
hooks/
  use-user.ts                — current user + profile, role detection
  use-profile.ts             — fetch any profile by id
  use-group.ts               — single group + members
  use-groups.ts              — all groups for current user
  use-tasks.ts               — tasks for a group (filters deleted_at)
  use-activity.ts            — timeline feed for a group
  use-evidence.ts            — evidence for a single task
  use-group-evidence.ts      — evidence for all tasks in a group
  use-evaluation.ts          — peer review submission state
  use-evaluation-session.ts  — whether peer review is open for a group
  use-evaluation-summaries.ts — aggregated peer review scores
  use-course.ts              — single course
  use-courses.ts             — all courses for teacher
  use-create-course.ts       — course creation mutation
```

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

## What's Missing (next priorities)

1. **Course-level analytics** — cross-group completion rates, active vs stalled groups, member participation summary
2. **Real-time monitoring** — becomes the paid teacher feature tier
3. **Auth robustness** — edge cases still exist

## Avoid

- App Router conventions — Pages Router only
- Teal anywhere — removed from brand
- Hard deleting tasks — soft delete (`deleted_at`) only
- Mutating/deleting evidence — version only
- Showing individual peer review scores — averages only
- Emojis — SVG icons only (`components/icons.tsx`)
- Scope creep — every feature must answer: "does this make individual effort visible in group work?"

## Business Model

- Students: free forever
- Teachers/institutions: pay for real-time monitoring + AI features (not yet built)
