# Inline Tips + What's New Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contextual inline tips across 6 pages and a "What's New" nav badge with changelog dropdown.

**Architecture:** Inline tips use the existing `InlineTip` component — just add instances to pages. The "What's New" badge is a new component (`whats-new.tsx`) with hardcoded changelog data and localStorage-based seen tracking, placed in `NavShell` next to the notification bell.

**Tech Stack:** Next.js Pages Router, TypeScript, Tailwind CSS, localStorage

**Spec:** `docs/superpowers/specs/2026-03-31-guidance-changelog-design.md`

---

### Task 1: Add inline tips to student pages

**Files:**
- Modify: `pages/dashboard.tsx`
- Modify: `components/group-tasks-tab.tsx`
- Modify: `pages/profile.tsx`

- [ ] **Step 1: Read the three files to understand current structure**

Read `pages/dashboard.tsx`, `components/group-tasks-tab.tsx`, and `pages/profile.tsx` to find exact insertion points.

- [ ] **Step 2: Add tips to `pages/dashboard.tsx`**

Add import (if not already present):
```ts
import InlineTip from '@/components/inline-tip';
```

Add two tips inside the content area, right after the `{/* Content */}` div opens (after `<div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">`):

```tsx
<InlineTip id="dashboard-telegram">Connect Telegram in your profile to get deadline reminders 24h before.</InlineTip>
{contributionCounts.total > 0 && (
  <InlineTip id="dashboard-contribution">Your contribution summary shows completed work by type across all groups.</InlineTip>
)}
```

Note: `contributionCounts` comes from the `useContributionSummary` hook already in the file.

- [ ] **Step 3: Add tips to `components/group-tasks-tab.tsx`**

The file already imports `InlineTip` but doesn't use it. Add two tips at the top of the component's return, right after the opening `<div>`:

```tsx
<InlineTip id="tasks-log-work">Mark tasks as done and log evidence to build your Contribution Record for grading.</InlineTip>
<InlineTip id="tasks-types">Tag tasks by type (research, meeting, coordination) to show the full picture of your contributions.</InlineTip>
```

Place them before the kanban board / task list content, inside the main content wrapper.

- [ ] **Step 4: Add tip to `pages/profile.tsx`**

Add import:
```ts
import InlineTip from '@/components/inline-tip';
```

Find where the Telegram connection section is rendered. Add the tip BEFORE the Telegram section, but only when Telegram is NOT connected. The condition depends on the page's state — look for the Telegram connected/not-connected conditional and add:

```tsx
{!telegramConnected && (
  <InlineTip id="profile-telegram">Connecting Telegram lets you receive task reminders and team notifications on your phone.</InlineTip>
)}
```

Use whatever variable name the page uses for Telegram connection status.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add pages/dashboard.tsx components/group-tasks-tab.tsx pages/profile.tsx
git commit -m "Add inline tips to dashboard, tasks tab, and profile page"
```

---

### Task 2: Add inline tips to teacher and onboarding pages

**Files:**
- Modify: `pages/teacher/index.tsx`
- Modify: `pages/teacher/course/[id]/index.tsx`
- Modify: `pages/onboarding.tsx`

- [ ] **Step 1: Read the three files**

Read each file to find exact insertion points.

- [ ] **Step 2: Add tip to `pages/teacher/index.tsx`**

Add import:
```ts
import InlineTip from '@/components/inline-tip';
```

Inside the content area, after the topbar section, add:

```tsx
{courses.length > 0 && (
  <InlineTip id="teacher-invite">Share your course invite link with students. They can enroll and form groups themselves.</InlineTip>
)}
```

Place it before the course list but inside the max-width content wrapper.

- [ ] **Step 3: Add tip to `pages/teacher/course/[id]/index.tsx`**

Add import:
```ts
import InlineTip from '@/components/inline-tip';
```

Inside the content area, before the alert banner / stats pills, add:

```tsx
{groups.length > 0 && (
  <InlineTip id="teacher-attention">Groups flagged &quot;needs attention&quot; are overdue, inactive, or have unresolved blockers.</InlineTip>
)}
```

- [ ] **Step 4: Add tip to `pages/onboarding.tsx`**

Add import:
```ts
import InlineTip from '@/components/inline-tip';
```

Add at the top of the form/content area:

```tsx
<InlineTip id="onboarding-role">Your role determines which dashboard you see. Students track group work. Teachers monitor courses.</InlineTip>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add pages/teacher/index.tsx pages/teacher/course/[id]/index.tsx pages/onboarding.tsx
git commit -m "Add inline tips to teacher dashboard, course page, and onboarding"
```

---

### Task 3: Create What's New component

**Files:**
- Create: `components/whats-new.tsx`

- [ ] **Step 1: Create `components/whats-new.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';

interface ChangelogItem {
  title: string;
  description: string;
}

interface ChangelogEntry {
  version: number;
  date: string;
  items: ChangelogItem[];
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

const LATEST_VERSION = Math.max(...CHANGELOG.map((e) => e.version));
const STORAGE_KEY = 'contrib_changelog_seen';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WhatsNew({ sidebar }: { sidebar?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [seenVersion, setSeenVersion] = useState(LATEST_VERSION);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const seen = stored ? parseInt(stored, 10) : 0;
      setSeenVersion(seen);
      if (seen < LATEST_VERSION) setHasUnseen(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open) {
      setHasUnseen(false);
      try { localStorage.setItem(STORAGE_KEY, String(LATEST_VERSION)); } catch {}
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className={sidebar
          ? 'relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-brand-light transition-colors'
          : 'relative w-11 h-11 flex items-center justify-center flex-shrink-0 active:opacity-80'
        }
        aria-label="What's new"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2l2.3 4.6 5 .7-3.6 3.5.8 5L10 13.4 5.5 15.8l.8-5L2.7 7.3l5-.7L10 2z" />
        </svg>
        {hasUnseen && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" style={{ border: '2px solid white' }} />
        )}
      </button>

      {open && (
        <div className={
          sidebar
            ? 'absolute left-full top-0 ml-2 w-72 bg-white border border-border rounded-xl shadow-dropdown max-h-[400px] overflow-y-auto z-[200]'
            : 'absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-dropdown max-h-[400px] overflow-y-auto z-[200]'
        }>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold text-text">What&apos;s New</span>
          </div>
          <div className="p-3 flex flex-col gap-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version}>
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-2">
                  {formatDate(entry.date)}
                </p>
                <div className="flex flex-col gap-2.5">
                  {entry.items.map((item) => (
                    <div key={item.title} className="flex gap-2.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0"
                        style={{ backgroundColor: entry.version > seenVersion ? '#1A56E8' : '#E2E8F0' }}
                      />
                      <div>
                        <p className="text-[13px] font-medium text-text">{item.title}</p>
                        <p className="text-[12px] text-text-secondary mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/whats-new.tsx
git commit -m "Create What's New component with changelog dropdown and unseen badge"
```

---

### Task 4: Integrate What's New into NavShell

**Files:**
- Modify: `components/nav-shell.tsx`

- [ ] **Step 1: Read `components/nav-shell.tsx`**

Read the full file to understand the layout.

- [ ] **Step 2: Add import**

```ts
import WhatsNew from '@/components/whats-new';
```

- [ ] **Step 3: Add WhatsNew to mobile topbar**

Find the line with `<NotificationBell userId={profile?.id} />` in the mobile topbar section (around line 83). Add `<WhatsNew />` right before it:

```tsx
<WhatsNew />
<NotificationBell userId={profile?.id} />
```

- [ ] **Step 4: Add WhatsNew to desktop sidebar**

Find the line with `<NotificationBell userId={profile?.id} sidebar />` in the desktop sidebar section (around line 188). Add `<WhatsNew sidebar />` right before it:

```tsx
<WhatsNew sidebar />
<NotificationBell userId={profile?.id} sidebar />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd contrib && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/nav-shell.tsx
git commit -m "Add What's New badge to nav sidebar and mobile topbar"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd contrib && npx tsc --noEmit`

- [ ] **Step 2: Run build**

Run: `cd contrib && npm run build`

- [ ] **Step 3: Commit and push**

```bash
git status
git push origin main
```
