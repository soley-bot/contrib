# Contrib — Product Requirements Document
**Version:** 2.0
**Date:** March 2026
**Status:** Active

| Product | Market |
|---------|--------|
| **Contrib — Group Contribution Tracker** | **Cambodia first** |
| Stack | Notifications |
| **Next.js (Pages Router) + Supabase + Vercel** | **In-app activity feed** |
| Language | PDF Export |
| **English (Khmer toggle v2)** | **Client-side PDF generation** |

---

## 1. Product Overview

### 1.1 Vision

Individual effort is invisible in group work. The output is shared — but the work never was. Contrib makes individual effort visible while it's happening, so the people who did the work get the credit for it.

Contrib gives university students in Cambodia a timestamped record of who did what in a group assignment — and generates a Contribution Record PDF formatted like the peer evaluation forms teachers already use. Teachers get real-time visibility into every group. Free-riding stops being invisible.

**Soul: Individual effort is invisible in group work. Contrib turns it on.**

### 1.2 Taglines

| Audience | Tagline |
|----------|---------|
| Students | Your work. On record. |
| Teachers | See who did the work — before you grade it. |

### 1.3 What Contrib Is

- A group contribution tracker for university students and teachers
- Task-based: members log tasks, mark them done, and upload timestamped evidence
- Timeline-first: every action is recorded automatically — immutable, versioned
- Contribution Record: the output is a structured PDF formatted like Cambodian university peer evaluation forms
- Free for students: no paywall, no premium tier for student features
- Paid for teachers: real-time monitoring dashboard (current build priority)

### 1.4 What Contrib Is NOT

- Not a communication tool — no in-app chat or comments
- Not a file storage platform — evidence is referenced, not stored as a library
- Not an LMS — no grades, rubrics, or deep course integration
- Not a time tracker — tasks are logged done, not timed
- Not a social network — no feed, no follows, no profile discovery
- Not a surveillance tool — framing is always empowerment, not monitoring

### 1.5 Users

| Role | Description | Access |
|------|-------------|--------|
| Student | Creates/joins groups, manages tasks, logs work, submits peer review | Free forever |
| Teacher | Creates courses, monitors groups in real-time, downloads Contribution Records | Paid (current build) |
| Institution | Policy-level adoption, cross-course analytics | Not yet designed — future |

---

## 2. Codebase Rules — MUST FOLLOW

> **These rules are non-negotiable. Follow them on every file, every task.**

### 2.1 File Naming Convention

ALL files use lowercase hyphenated names. No exceptions.

| CORRECT | WRONG |
|---------|-------|
| task-card.tsx | TaskCardComponent.tsx |
| group-dashboard.tsx | GroupDashboardPage.tsx |
| use-tasks.ts | useTasksHook.ts |
| supabase-client.ts | SupabaseClientConfig.ts |
| index.tsx | HomePage.tsx |

### 2.2 No Versioned Filenames — Ever

| RULE | Detail |
|------|--------|
| Never create | task-card-v2.tsx, task-card-new.tsx, task-card-final.tsx, or any variant. Git is the version history. Edit in place. Delete before replacing. |

### 2.3 Folder Structure

```
contrib/
├── pages/                        ← Routes only. No logic.
│   ├── index.tsx                 ← Landing page
│   ├── dashboard.tsx             ← My Groups (student) / My Courses (teacher)
│   ├── group/
│   │   └── [id].tsx              ← Group view (tasks, timeline, members, peer review)
│   ├── join/
│   │   └── [token].tsx           ← Join via invite link
│   ├── teacher/
│   │   ├── dashboard.tsx         ← Teacher course list
│   │   └── course/
│   │       └── [id]/
│   │           ├── index.tsx     ← Course groups overview
│   │           └── group/
│   │               └── [groupId].tsx ← Group drill-down (read-only teacher view)
│   └── api/
│       └── auth/
│           └── signup.ts
├── components/                   ← Reusable UI only. Short names.
├── lib/                          ← Utilities, clients, helpers
│   ├── supabase.ts
│   ├── pdf.ts
│   └── invite.ts
├── hooks/                        ← Custom React hooks
├── types/
│   └── index.ts
├── styles/
│   └── globals.css
└── public/
```

### 2.4 Component Rules

- One component per file
- Components only handle UI — no data fetching inside components
- Data fetching belongs in hooks or pages
- No component does more than one thing
- Keep components under 150 lines — if longer, split it

### 2.5 No Speculative Code

Build only what is in this PRD. Do not add features, fields, columns, or components not explicitly listed. When in doubt, do less.

---

## 3. Database Schema (Supabase)

> **Lean schema. Only columns needed now. No speculative fields.**

### 3.1 Table: profiles

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | FK → auth.users(id) |
| name | text | YES | Display name |
| university | text | YES | Free text |
| role | text | YES | `'student'` or `'teacher'` — default `'student'` |
| faculty | text | NO | Optional |
| year_of_study | text | NO | Optional |
| avatar_url | text | NO | Optional |
| created_at | timestamptz | YES | Default now() |

### 3.2 Table: courses

Teacher-created courses. Groups link to courses.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| name | text | YES | Course name |
| subject | text | YES | Subject code |
| teacher_id | uuid | YES | FK → profiles(id) |
| invite_token | text | YES | Unique — for students to link groups |
| created_at | timestamptz | YES | Default now() |

### 3.3 Table: groups

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| name | text | YES | e.g. "Business Strategy Final" |
| subject | text | YES | e.g. "MGT 402" |
| due_date | date | NO | Optional |
| lead_id | uuid | YES | FK → profiles(id) |
| invite_token | text | YES | Unique — for member join links |
| course_id | uuid | NO | Nullable FK → courses(id) |
| created_at | timestamptz | YES | Default now() |

### 3.4 Table: group_members

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | FK → groups(id) |
| profile_id | uuid | YES | FK → profiles(id) |
| joined_at | timestamptz | YES | Default now() |

Unique constraint on (group_id, profile_id).

### 3.5 Table: tasks

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | FK → groups(id) |
| title | text | YES | |
| description | text | NO | Optional |
| assignee_id | uuid | YES | FK → profiles(id) |
| status | text | YES | `todo`, `inprogress`, `done` — default `todo` |
| due_date | date | NO | Optional |
| completed_at | timestamptz | NO | Set when status → done |
| deleted_at | timestamptz | NO | Soft delete — never hard delete |
| created_at | timestamptz | YES | Default now() |

> **RULE:** Always filter `WHERE deleted_at IS NULL` when querying active tasks.

### 3.6 Table: evidence

Immutable and versioned. Never update or delete rows.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| task_id | uuid | YES | FK → tasks(id) |
| uploaded_by | uuid | YES | FK → profiles(id) |
| type | text | YES | `'file'`, `'link'`, or `'note'` |
| content | text | YES | URL, link, or note text |
| version_number | integer | YES | Starts at 1, increments per task |
| created_at | timestamptz | YES | Immutable |

> **RULE:** To update evidence, insert a new row with version_number + 1. Never mutate.

### 3.7 Table: activity_log

Append-only audit trail. Never update or delete.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | FK → groups(id) |
| actor_id | uuid | YES | FK → profiles(id) |
| action | text | YES | See action enum below |
| task_id | uuid | NO | FK → tasks(id) if task-related |
| meta | jsonb | NO | Extra context |
| created_at | timestamptz | YES | Default now() |

**Action enum:** `task_created`, `task_assigned`, `task_updated`, `task_done`, `task_edited`, `task_deleted`, `task_reassigned`, `file_uploaded`, `evidence_added`, `evidence_version_added`, `member_joined`, `member_left`, `member_removed`, `lead_transferred`, `group_updated`, `evaluation_opened`, `evaluation_submitted`

### 3.8 Table: evaluation_sessions

One row per group when the lead opens peer review. One session per group (unique constraint).

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | Unique FK → groups(id) |
| opened_by | uuid | YES | FK → profiles(id) |
| opened_at | timestamptz | YES | Default now() |

### 3.9 Table: evaluations

Peer-to-peer scores. One row per evaluator→evaluatee pair per group.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | FK → groups(id) |
| evaluator_id | uuid | YES | FK → profiles(id) |
| evaluatee_id | uuid | YES | FK → profiles(id) |
| contribution_score | integer | YES | 1–5 |
| collaboration_score | integer | YES | 1–5 |
| comment | text | NO | Optional |
| submitted_at | timestamptz | YES | Default now() |

Unique constraint on (group_id, evaluator_id, evaluatee_id).

---

## 4. Core Features

### Student Features (Built)

#### Feature 1: Sign Up + Profile
**Route:** /signup

- Name, university, role (student/teacher), optional faculty + year
- Email + password via Supabase Auth
- On submit: create auth user, insert into profiles, redirect to /dashboard

#### Feature 2: Group Creation + Invite
**Route:** /dashboard

- Student creates a group: name, subject, optional due date
- Unique invite_token generated on creation
- Invite link: contrib.app/join/[token]
- Members join via link (must be logged in)
- Optional: link group to a course via course invite token

#### Feature 3: Task Management
**Route:** /group/[id] — Tasks tab

- Kanban: To Do, In Progress, Done
- Any member can create a task: title, assignee, description (optional), due date (optional)
- Assignee moves their own task; lead can move any task
- Moving to Done sets completed_at and writes to activity_log
- Evidence (file/link/note) can be logged at any point — immutable, versioned

#### Feature 4: Timeline
**Route:** /group/[id] — Timeline tab

*(Previously called "Activity" — renamed to reflect that it's a record, not a feed)*

- Chronological, most recent first
- Each entry: actor name, action, task reference, timestamp
- Read-only — append only

#### Feature 5: Peer Review
**Route:** /group/[id] — Peer Review tab

*(Previously called "Evaluation")*

- Lead opens peer review when all tasks are done
- Each member rates every other member: contribution score (1–5), collaboration score (1–5), optional comment
- Results shown as averages — individual scores are never shown to peers (anonymous by design)
- Pre-submission message: "Your ratings are combined with your teammates'. No one will see your individual scores."

#### Feature 6: Contribution Record (PDF Export)
**Route:** /group/[id] — Export button

*(Previously called "Export Report" — renamed to "Export Contribution Record")*

- Available to group lead
- Generated client-side via lib/pdf.ts
- Contains: group summary, per-member contribution breakdown, task list with timestamps, full timeline, peer review summary
- Formatted to mirror Cambodian university peer evaluation forms
- Footer: "Generated by Contrib · Activity data is automatically recorded"

---

### Teacher Features (Current Build Priority)

#### Feature 7: Course Management
**Route:** /teacher/dashboard

- Teacher creates a course: name, subject
- Course invite token generated — students link their group to the course
- Course dashboard shows all linked groups with progress bars

#### Feature 8: Group Drill-Down ← BUILD NEXT
**Route:** /teacher/course/[id]/group/[groupId]

- Read-only view of a specific group's task board, timeline, members, and peer review results
- This is the minimum credible teacher experience
- Must be ready before the Leap Sok meeting

#### Feature 9: Course Analytics ← NEXT AFTER DRILL-DOWN
**Route:** /teacher/course/[id]

- Completion rates across all groups
- Active vs stalled groups at a glance
- Member participation summary per group

#### Feature 10: Real-Time Monitoring ← PAID TIER
- Live activity updates without page refresh
- This becomes the paid feature gate

---

## 5. Authentication

### 5.1 Method
- Supabase Auth — email + password only
- No OAuth in current version
- No email verification required

### 5.2 Protected Routes

| Route | Rule |
|-------|------|
| /dashboard | Requires auth |
| /group/[id] | Requires auth + group membership |
| /join/[token] | Requires auth — redirect to /signup with return URL if not logged in |
| /teacher/* | Requires auth + role = 'teacher' |
| / | Public |
| /signup | Public — redirect to /dashboard if already logged in |

### 5.3 Session Handling
- Supabase client-side session via `supabaseClient.auth.getSession()`
- `useUser` hook in hooks/use-user.ts provides current user across the app
- On sign out: clear session, redirect to /

---

## 6. UI Direction

> **Light theme. Flat. Modern. Mobile-first. Not corporate, not playful.**

### 6.1 Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Brand Blue | #1A56E8 | Primary actions, links, brand |
| Slate | #0F172A | Primary text, dark surfaces |
| Blue Tint | #EBF0FF | Backgrounds, hover states |
| Off White | #F8FAFF | Page background |
| Teacher Blue | #1240C4 | Teacher-facing pages only |

> **Note:** Teal (#0E7490) has been removed from the brand entirely. Do not use it.

**Font:** Plus Jakarta Sans — already loaded via CSS
- Hero headings: weight 800
- Section headings: weight 700
- Card titles: weight 600
- UI labels: weight 500
- Body: weight 400

### 6.2 Design Rules

- No gradients, no heavy shadows — flat design only
- SVG icons only — no emojis anywhere in the UI
- Soft delete for tasks — never hard delete
- Evidence is immutable — upload new version, never mutate
- Teacher pages use #1240C4 (dark blue) to visually separate teacher experience from student experience
- Student pages use #1A56E8 (brand blue)

### 6.3 Key Components

**Nav:** Fixed top, white background, bottom border. Logo left. Role-aware routing.

**Task Card:** Title, assignee chip, due date, status badge. Clickable to open task modal.

**Timeline Item:** Actor name + action + task reference + timestamp. Read-only.

**Invite Banner:** Shown at top of group view when group has fewer than 6 members. Dashed border, copy-link button.

**Empty States:** Flat vector illustration, short headline, one-line subtext. No emoji.

---

## 7. Feature Naming — Locked

| Old Name | New Name | Where |
|----------|----------|-------|
| Activity | Timeline | Tab label, nav |
| Evaluation | Peer Review | Tab label, nav |
| Export Report (PDF) | Export Contribution Record | Button label |
| PDF Report | Contribution Record | Document name |
| Upload evidence | Log your work | Action label |

---

## 8. Environment Variables

Store in .env.local — never commit to Git.

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 9. Do NOT Build Yet

> These are real ideas — they're just not now.

- In-app chat or task comments
- Real-time sync for students (polling/websockets) — page refresh is acceptable
- Native mobile app (iOS or Android)
- Email or push notifications
- Gamification, points, badges
- Admin dashboard
- Monetization UI or premium gating
- Google / Facebook OAuth
- Multiple assignees per task
- Time tracking
- Institution-level dashboard (university admin role)
- AI-powered contribution analysis
- Khmer language toggle

---

## 10. Build Priority Order

| Priority | Feature | Done when... |
|----------|---------|--------------|
| 1 | Group drill-down `/teacher/course/[id]/group/[groupId]` | Teacher can see task board, timeline, members, peer review results for any group — read-only |
| 2 | Feature naming update | All renamed labels applied across student and teacher views |
| 3 | Course analytics `/teacher/course/[id]` | Completion rates, active vs stalled, member participation |
| 4 | Real-time monitoring | Live updates without page refresh — paid tier gate |
| 5 | Landing page | Built, live, matches brand and narrative |
| 6 | Teacher outreach + first case study | One teacher runs a real assignment through Contrib |

---

## 11. Success Metrics

| Metric | Minimum Signal | Strong Signal |
|--------|---------------|---------------|
| Teachers running real assignments | 1 | 5+ |
| Groups created | 50 in first month | 150+ in first month |
| Contribution Records exported | At least 1 per group | >80% of groups export |
| Tasks completed per group | Average 3+ | Average 6+ |
| Repeat usage (2+ groups) | 20% of users | 40%+ of users |
| Teacher friction reports | 0 | 0 |

---

## 12. Product Narrative (for pitching and marketing)

**Beat 1 — The world before**
Every semester, the same thing happens. A group of students gets assigned a project. Four people work. One doesn't. The deadline comes, the presentation goes well, and the teacher gives everyone the same grade.

**Beat 2 — Why it persists**
Teachers know. They just can't see. Peer evaluation forms exist — but they're filled out at the end, from memory, under social pressure. The form becomes a formality. The effort was always invisible.

**Beat 3 — What Contrib does**
Students log tasks, upload timestamped evidence, and evaluate each other inside Contrib. Teachers get a live window into every group — a Contribution Record they can use to grade fairly. It's not a new behavior. It's the peer evaluation form universities already use — with a timestamp on every action.

**Beat 4 — The world after**
The student who pulled the group gets recognized. The teacher grades with evidence, not instinct. Free-riding stops being invisible — and over time, stops being worth it.

**Beat 5 — Why now, why Cambodia**
237,000 students. 189 institutions. No tool built for this context. The peer evaluation habit already exists. Contrib doesn't ask universities to change — it gives them the tool to do what they always intended.

---

## 13. Open Questions

1. Should peer review scores be visible to the group lead, or only to the teacher?
2. What is the exact Cambodian university peer evaluation form format to mirror in the Contribution Record?
3. Should the Contribution Record be exportable by any member, or lead only?
4. How should group archiving work — archive state or deletion?
5. What triggers the paid tier gate for teachers — course size, number of groups, or feature access?

---

*End of document. Version 2.0 — March 2026.*
