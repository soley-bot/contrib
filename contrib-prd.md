# Contrib — Product Requirements Document
**Version:** 1.0
**Date:** March 2026
**Status:** Draft

| Product | Market |
|---------|--------|
| **Contrib — Group Project Tracker** | **Cambodia first** |
| Stack | Notifications |
| **Next.js (Pages Router) + Supabase + Vercel** | **In-app activity feed** |
| Language | PDF Export |
| **English (Khmer toggle v2)** | **Client-side PDF generation** |

---

## 1. Product Overview

### 1.1 Vision

Contrib gives university students in Cambodia a timestamped record of who did what in a group assignment — and auto-generates a contribution report PDF formatted like the peer eval form teachers already use. The platform handles activity tracking and evidence upload only. What happens in the session is between the students.

**Core tagline: Track. Prove. Export.**

### 1.2 What Contrib Is

- A group project tracker for university students
- Task-based: members are assigned tasks, mark them done, and upload evidence
- Timestamped: every action is logged automatically
- PDF-first: the output is a contribution report formatted like the peer eval forms teachers already expect
- Free to use: no paywall, no premium tier in v1

### 1.3 What Contrib Is NOT

- Not a communication tool — no in-app chat or comments
- Not a file storage platform — evidence links/uploads are references only
- Not an LMS — no grades, rubrics, or course integration
- Not a time tracker — tasks are marked done, not timed
- Not a social network — no feed, no follows, no profile discovery

### 1.4 Target User

| Field | Detail |
|-------|--------|
| Who | University students in Cambodia, ages 18–26 |
| Context | Group assignments, 3–6 members, per subject per semester |
| Device | Mobile-first (phone), web app not native |
| Motivation | Prove contribution fairly; hold free-riders accountable |
| Teacher role | Receives PDF only — no sign-up, no dashboard in v1 |

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
| Never create | task-card-v2.tsx, task-card-new.tsx, task-card-final.tsx, or any variant. Git is the version history. If a file needs updating, edit it in place. |

**Workflow when updating a file:**
- Edit the existing file directly
- Never duplicate it with a new name
- If replacing a file entirely, delete the old one before creating the new one
- If unsure whether old code is still needed — delete it. Git has it.

### 2.3 Folder Structure

Strict folder structure. No files outside their designated folder.

```
contrib/
├── pages/                    ← Routes only. No logic.
│   ├── index.tsx             ← Landing page
│   ├── dashboard.tsx         ← My Groups list
│   ├── group/
│   │   └── [id].tsx          ← Group dashboard (tasks, feed, members)
│   ├── join/
│   │   └── [token].tsx       ← Join via invite link
│   └── api/
│       ├── groups/
│       ├── tasks/
│       └── report/
├── components/               ← Reusable UI only. Short names.
│   ├── nav.tsx
│   ├── task-card.tsx
│   ├── task-modal.tsx
│   ├── member-row.tsx
│   ├── feed-item.tsx
│   └── invite-banner.tsx
├── lib/                      ← Utilities, clients, helpers
│   ├── supabase.ts           ← Supabase client (one file, one export)
│   ├── pdf.ts                ← PDF generation logic
│   └── invite.ts             ← Invite token generation/validation
├── hooks/                    ← Custom React hooks
│   ├── use-user.ts
│   ├── use-group.ts
│   └── use-tasks.ts
├── types/                    ← TypeScript interfaces
│   └── index.ts              ← All types in one file
├── styles/
│   └── globals.css
└── public/
```

### 2.4 Component Rules

- One component per file
- Components only handle UI — no data fetching inside components
- Data fetching belongs in hooks (hooks/ folder) or pages
- No component does more than one thing
- Keep components under 150 lines — if longer, split it

### 2.5 No Speculative Code

| RULE | Detail |
|------|--------|
| Only build what is in this PRD. | Do not add features, fields, columns, or components that are not explicitly listed here. When in doubt, do less. |

---

## 3. Database Schema (Supabase)

> **Design principle: lean schema. Only columns needed now. No nullable columns unless truly optional. No speculative fields.**

### 3.1 Table: profiles

Extended from Supabase Auth (auth.users).

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | References auth.users(id). Primary key. |
| name | text | YES | Display name |
| university | text | YES | Free text in v1 |
| created_at | timestamptz | YES | Default now() |

### 3.2 Table: groups

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key, default gen_random_uuid() |
| name | text | YES | e.g. "Business Strategy Final" |
| subject | text | YES | e.g. "MGT 402" |
| due_date | date | NO | Optional assignment due date |
| lead_id | uuid | YES | References profiles(id). Group creator. |
| invite_token | text | YES | Unique token for invite link. |
| created_at | timestamptz | YES | Default now() |

### 3.3 Table: group_members

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | References groups(id) |
| profile_id | uuid | YES | References profiles(id) |
| joined_at | timestamptz | YES | Default now() |

Unique constraint on (group_id, profile_id).

### 3.4 Table: tasks

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key, default gen_random_uuid() |
| group_id | uuid | YES | References groups(id) |
| title | text | YES | Short task title |
| description | text | NO | Optional detail |
| assignee_id | uuid | YES | References profiles(id) |
| status | text | YES | todo, inprogress, done. Default todo. |
| due_date | date | NO | Optional |
| evidence_url | text | NO | Link or uploaded file URL |
| completed_at | timestamptz | NO | Set when status moves to done |
| created_at | timestamptz | YES | Default now() |

> **RULE:** Do NOT add columns for ratings, effort scores, or comments on tasks. That is a future feature. Keep this table lean.

### 3.5 Table: activity_log

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | YES | Primary key |
| group_id | uuid | YES | References groups(id) |
| actor_id | uuid | YES | References profiles(id). Who did the action. |
| action | text | YES | task_created, task_assigned, task_done, file_uploaded, member_joined |
| task_id | uuid | NO | References tasks(id) if action is task-related |
| meta | jsonb | NO | Extra context, e.g. { "task_title": "..." } |
| created_at | timestamptz | YES | Default now() |

---

## 4. Core Features

> **Build these five features only. Nothing else in v1.**

### Feature 1: Sign Up + Profile

**Route:** /signup (public) and /dashboard (redirect after auth)

**Flow:**
- Step 1 — Name and university
- Step 2 — Email + password (Supabase Auth)
- On submit: create auth user, insert into profiles, redirect to /dashboard

**Rules:**
- All steps on one page — not separate pages
- Validate all required fields before submit
- No email verification required in v1

---

### Feature 2: Group Creation + Invite

**Route:** /dashboard

**Flow:**
- Lead creates a group: name, subject, optional due date
- Group is created; a unique invite_token is generated (lib/invite.ts)
- Invite link is displayed: contrib.app/join/[token]
- Lead shares the link with teammates
- Members visit the link, see group details, and join with one click (must be logged in)

**Rules:**
- Invite token is a random URL-safe string, stored in groups.invite_token
- Joining requires auth — if not logged in, redirect to /signup with return URL
- No expiry on invite tokens in v1
- A member can only join a group once (enforced by unique constraint)

---

### Feature 3: Task Management

**Route:** /group/[id] — Tasks tab

**What it shows:**
- Kanban board: three columns — To Do, In Progress, Done
- Each task card shows: title, assignee, due date, status

**Flow:**
- Any member can create a task: title, description (optional), assignee, due date (optional)
- Any member can move their own assigned task to In Progress or Done
- Lead can move any task
- When a task is moved to Done: completed_at is set, activity_log entry is created
- Optional: evidence_url can be added when marking Done

**Rules:**
- No drag-and-drop in v1 — use a status dropdown or buttons
- Moving a task always writes to activity_log
- Status values are exactly: todo, inprogress, done — no others

---

### Feature 4: Activity Feed

**Route:** /group/[id] — Activity tab

**What it shows:**
- Chronological list of all activity_log entries for the group
- Each entry: actor name, action description, timestamp
- Most recent first

**Rules:**
- Read-only — no deleting or editing feed entries
- Feed is rebuilt from activity_log on page load — no separate feed table

---

### Feature 5: Contribution Report (PDF Export)

**Route:** /group/[id] — Export button (Lead only)

**What it generates:**
- Group name, subject, export date
- Member summary table: tasks assigned, tasks done, completion rate per member
- Per-member section: list of their completed tasks with completion timestamps and evidence links
- Full activity timeline: every entry from activity_log in chronological order
- Footer: "Generated by Contrib · Activity data is automatically recorded"

**Rules:**
- Export is available to the Lead only
- Generated client-side using lib/pdf.ts — no server needed
- PDF is formatted to resemble standard Cambodian university peer evaluation forms
- Do not add a digital signature or tamper-detection in v1 — plain PDF is sufficient

---

## 5. Authentication

### 5.1 Method

- Supabase Auth — email + password only
- No OAuth (Google, Facebook) in v1
- No email verification required in v1

### 5.2 Protected Routes

- /dashboard — requires auth, redirect to /signup if not logged in
- /group/[id] — requires auth AND group membership
- /join/[token] — requires auth, redirect to /signup with return URL if not logged in
- / (landing) — public
- /signup — public, redirect to /dashboard if already logged in

### 5.3 Session Handling

- Use Supabase client-side session (supabaseClient.auth.getSession())
- useUser hook in hooks/use-user.ts provides current user across the app
- On sign out: clear session, redirect to /

---

## 6. UI Direction

> **Light theme. Clean. Mobile-first. Student-friendly, not corporate.**

### 6.1 Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| --bg | #F9FAFB | Page background |
| --surface | #FFFFFF | Card backgrounds |
| --border | #E5E7EB | Card borders |
| --text | #111827 | Primary text |
| --muted | #6B7280 | Secondary text |
| --brand | #5B4FFF | Primary action, links |
| --green | #22C55E | Done state, success |
| --yellow | #F59E0B | In Progress state |
| --red | #EF4444 | Overdue, error states |

**Fonts:**
- Headings: Inter — weight 700, 800
- Body: Inter — weight 400, 500
- Use Google Fonts CDN

**Spacing:**
- Use 8px grid throughout
- Card padding: 20px 24px
- Section spacing: 32px between sections

### 6.2 Key Components

**Nav (nav.tsx):**
- Fixed top, white background, bottom border
- Logo left: "Contrib" wordmark
- Right: group name (if inside a group) + avatar + sign out

**Task Card (task-card.tsx):**
- White surface card with border
- Title, assignee chip (avatar initial + name), due date, status badge
- Clickable to open task-modal.tsx

**Feed Item (feed-item.tsx):**
- Icon dot (emoji per action type) + actor name + action text + timestamp
- No interaction — read-only

**Invite Banner (invite-banner.tsx):**
- Dashed brand-color border
- Invite link text + Copy button
- Shown at top of group dashboard

---

## 7. Environment Variables

Store in .env.local — never commit to Git.

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 8. Do NOT Build in v1

> **If it is not in this PRD, do not build it.**

- In-app chat or comments on tasks
- Real-time sync (polling or websockets) — page refresh is acceptable
- Teacher dashboard or class codes
- Email or push notifications
- Native mobile app (iOS or Android)
- Profile photos or image upload (evidence is a URL or file link only)
- Ratings, effort scores, or peer scoring
- Gamification, points, badges
- Admin dashboard
- Reporting or flagging users
- Monetization or premium features
- Google / Facebook OAuth
- Email verification
- Multiple groups per assignment
- Time tracking or Pomodoro

---

## 9. Recommended Build Order

Build in this exact order. Do not jump ahead.

| Step | Task | Done when... |
|------|------|--------------|
| 1 | Project setup | Next.js (Pages Router) initialized, Tailwind configured, folder structure created |
| 2 | Supabase setup | Project created, all 5 tables created with correct schema |
| 3 | Auth | Email/password sign up and sign in working, useUser hook working |
| 4 | Group creation | Group created, invite token generated, invite link displayed |
| 5 | Join via link | Member visits /join/[token], joins group, appears in group_members |
| 6 | Task management | Create task, assign, move through statuses, activity_log written on each change |
| 7 | Activity feed | Feed tab shows all log entries for the group |
| 8 | PDF export | Lead clicks Export, PDF generated client-side with correct layout |
| 9 | Profile page | View name and university, edit working |
| 10 | Deploy | Live on Vercel, environment variables set, tested end-to-end |

---

## 10. Success Metrics

| Metric | Minimum Signal | Strong Signal |
|--------|---------------|---------------|
| Groups created | 50 in first month | 150+ in first month |
| PDFs exported | At least 1 per group | >80% of groups export |
| Tasks completed per group | Average 3+ | Average 6+ |
| Repeat usage (2+ groups) | 20% of users | 40%+ of users |
| Teacher friction reports | 0 | 0 |

---

## 11. Open Questions

1. Should join-by-link require any identity verification, or is a self-declared name enough for v1?
2. What peer eval format do Cambodian universities most commonly use — is there a standard layout to mirror exactly?
3. Should PDF export be locked to the Lead, or can any member export?
4. Do we need an archive state for completed groups, or is deletion sufficient for v1?

---

*End of document.*
