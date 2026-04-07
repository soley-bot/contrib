# In-App Guidance + What's New — Design Spec

**Date:** 2026-03-31
**Scope:** 2 features — expanded inline tips and a "What's New" nav badge

---

## 1. Expanded Inline Tips

Use the existing `InlineTip` component (no changes to it). Add tips to pages that currently have none.

### New tips to add

| Page | Tip ID | Text | Condition |
|---|---|---|---|
| `pages/dashboard.tsx` | `dashboard-telegram` | Connect Telegram in your profile to get deadline reminders 24h before. | Always (until dismissed) |
| `pages/dashboard.tsx` | `dashboard-contribution` | Your contribution summary shows completed work by type across all groups. | Only render when `contributionCounts.total > 0` |
| `components/group-tasks-tab.tsx` | `tasks-log-work` | Mark tasks as done and log evidence to build your Contribution Record for grading. | Always |
| `components/group-tasks-tab.tsx` | `tasks-types` | Tag tasks by type (research, meeting, coordination) to show the full picture of your contributions. | Always |
| `pages/profile.tsx` | `profile-telegram` | Connecting Telegram lets you receive task reminders and team notifications on your phone. | Only render when Telegram is NOT connected |
| `pages/teacher/index.tsx` | `teacher-invite` | Share your course invite link with students. They can enroll and form groups themselves. | Only render when teacher has at least 1 course |
| `pages/teacher/course/[id]/index.tsx` | `teacher-attention` | Groups flagged "needs attention" are overdue, inactive, or have unresolved blockers. | Only render when there are groups |
| `pages/onboarding.tsx` | `onboarding-role` | Your role determines which dashboard you see. Students track group work. Teachers monitor courses. | Always |

### Placement rules
- Tips go at the top of the main content area, below the topbar
- On dashboard: `dashboard-telegram` first, then `dashboard-contribution` (only if summary visible)
- On group tasks tab: `tasks-log-work` at top, `tasks-types` below it
- Each tip is dismissable and remembered in localStorage via the existing `contrib_tip_{id}` pattern

---

## 2. What's New Nav Badge

### New component: `components/whats-new.tsx`

A star icon with a blue dot indicator, placed in the nav sidebar. Opens a dropdown listing recent feature updates.

### Data structure (hardcoded, no database)

```ts
interface ChangelogEntry {
  version: number;
  date: string;
  items: { title: string; description: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 2,
    date: '2026-03-31',
    items: [
      { title: 'Deadline reminders', description: 'Get notified 24h before tasks and group deadlines via Telegram and in-app.' },
      { title: 'Contribution summary', description: 'See your completed work by type on the dashboard.' },
      { title: 'Auto-archive', description: 'Completed groups automatically move to "Past groups".' },
      { title: 'Teacher weekly digest', description: 'Teachers get a Monday summary of all courses via Telegram.' },
    ],
  },
  {
    version: 1,
    date: '2026-03-30',
    items: [
      { title: 'Telegram notifications', description: '6 notification types delivered to Telegram.' },
      { title: 'Shareable contribution records', description: 'Generate a public link to share your group contributions.' },
    ],
  },
];
```

### Badge logic
- `LATEST_VERSION` = highest `version` number in `CHANGELOG`
- localStorage key: `contrib_changelog_seen`
- On mount: read `localStorage.getItem('contrib_changelog_seen')`. If null or less than `LATEST_VERSION`, show blue dot
- On dropdown open: set `localStorage.setItem('contrib_changelog_seen', String(LATEST_VERSION))`, clear blue dot
- New entries are "unseen" if their version > the stored value. Render them with a blue dot. Older entries render with a gray dot.

### UI design
- **Icon:** Star SVG (same size as bell icon, 20px)
- **Blue dot:** Absolute positioned, top-right of star, 8px circle, `#1A56E8`, 2px white border
- **Dropdown:** Same positioning and styling as `notification-bell.tsx` dropdown
  - Width: `w-72` (288px), max-height scrollable
  - Header: "What's New" in semibold
  - Entries grouped by date
  - Each entry: title (13px semibold) + description (12px text-secondary)
  - Blue dot for unseen entries, gray dot for seen
  - Click outside to close (same pattern as notification bell)

### Placement
- In `components/nav-shell.tsx`, rendered next to the notification bell
- Both student and teacher navs see it (since NavShell is shared)

---

## What is NOT in scope

- Feature spotlight tour (deferred)
- Getting started checklist (deferred)
- Changelog page (deferred — nav dropdown is sufficient for now)
- Database storage for seen state (localStorage is fine at current scale)
