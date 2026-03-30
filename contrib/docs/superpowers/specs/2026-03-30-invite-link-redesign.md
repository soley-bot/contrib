# Invite Link Redesign — Design Spec
**Date:** 2026-03-30
**Status:** Approved
**Approach:** Option A — Surgical fixes to existing join pages

---

## Problem

Contrib has two invite link types: group join (`/join/[token]`) and course linking (`/join/course/[token]`). Both have the same core UX gap: unauthenticated users are immediately redirected to `/signup` with no context about what they're joining. This causes drop-off and confusion. Additional gaps: no way to reset/revoke a leaked token, no member count shown on join pages, and unhelpful error copy on invalid links.

---

## Scope

Four targeted improvements to the existing join flow. No architectural changes — the two-page URL structure (`/join/[token]` vs `/join/course/[token]`) is correct and stays.

---

## Change 1 — Unauthenticated Preview on Join Pages

**Both** `/join/[token]` and `/join/course/[token]` must show group/course info to unauthenticated users before asking them to log in.

### How it works

Move the token lookup to `getServerSideProps` so the page renders with data for everyone — authenticated or not. Auth state is checked client-side to determine which CTA to show.

**`/join/[token]` — group join page:**
- `getServerSideProps` calls the existing `/api/join/lookup?token=TOKEN` (already public — no auth required)
- If token not found → render "not found" state server-side (no redirect)
- If found → pass `{ group: { name, subject, memberCount } }` as props
- Client-side: if `!user && !userLoading` → show "Sign up to join" + "Already have an account? Log in" CTAs
- Client-side: if `user` → show existing "Join group" button flow

**`/join/course/[token]` — course linking page:**
- `getServerSideProps` does a public Supabase query: `SELECT id, name, subject FROM courses WHERE invite_token = $token`
- No auth needed — course name/subject are not sensitive
- If found → pass `{ course: { name, subject } }` as props
- Client-side: if `!user && !userLoading` → show "Sign up to link your group" + "Log in" CTAs
- Client-side: if `user` → show existing group selector / lead flow

### Auth CTA copy
- Group join, unauthenticated: **"Sign up to join"** (primary button) + **"Already have an account? Log in"** (text link)
- Course link, unauthenticated: **"Sign up to link your group"** (primary button) + **"Already have an account? Log in"** (text link)

### What does NOT change
- The `returnTo` redirect flow through signup/auth/onboarding (already fixed)
- The join logic itself — still runs client-side after auth is confirmed
- Rate limiting on the lookup API

---

## Change 2 — Member Count on Group Join Page

The group join page shows the group card with name and subject. Add current member count displayed as:
- Dot indicators: filled dots for current members, empty for remaining slots (6 max)
- Text label: "2 / 6 members"

This is shown to **all** users (authenticated and unauthenticated) as part of the preview.

**Data source:** The `/api/join/lookup` endpoint already returns group data. Add `member_count` to the response by joining `group_members` count.

**No change needed** if the group is full — the existing "group is full" screen stays. The count just surfaces the information earlier so users aren't surprised.

---

## Change 3 — Reset Invite Link

Group leads and teachers can regenerate their invite token at any time. Old token becomes invalid immediately.

### Where the button lives

**Group page** (group lead only): Inside the existing invite link section, below the URL display:
```
[link text]
Copy link   Reset link
```

**Teacher course page**: Inside the existing "Course invite link" box, below the URL display:
```
[link text]
Copy link   Reset link
```

### API endpoints

**`POST /api/groups/[id]/reset-invite`**
- Auth required: must be the group's `lead_id`
- Action: generate new UUID-based token, update `groups.invite_token`
- Returns: `{ invite_token: "new_token" }`
- Rate limit: 5 resets per group per hour

**`POST /api/courses/[id]/reset-invite`**
- Auth required: must be the course's `teacher_id`
- Action: generate new UUID-based token, update `courses.invite_token`
- Returns: `{ invite_token: "new_token" }`
- Rate limit: 5 resets per course per hour

### UX behaviour
- Button label: **"Reset link"** (muted text, no destructive styling — it's not dangerous, just a utility action)
- On click: show inline confirmation "Reset this link? The current link will stop working." with Confirm / Cancel
- On confirm: call API, update displayed URL client-side, show brief "Link reset" confirmation
- No full-page reload needed

### Token format
Same as existing: UUID v4, stored in `invite_token` column. No expiry date — permanent until manually reset.

---

## Change 4 — Better Error Copy on Invalid Links

Replace the generic "invalid or has been removed" message with actionable guidance.

| Page | Current copy | New copy |
|------|-------------|----------|
| `/join/[token]` | "This invite link is invalid or has been removed." | "This link is no longer valid. Ask your group lead for a new invite link." |
| `/join/course/[token]` | "This invite link is invalid or has been removed." | "This link is no longer valid. Ask your teacher for a new course link." |

No other changes to the not-found screen design.

---

## What Is Not In Scope

- Link expiry dates (permanent-until-reset is sufficient for now)
- Approval flows / join requests
- Per-link max-use caps (6-member limit on groups already handles this)
- Open Graph preview tags for link sharing in WhatsApp/Telegram (future)
- Email invites

---

## Files Affected

| File | Change |
|------|--------|
| `pages/join/[token].tsx` | Add `getServerSideProps` for public preview, unauthenticated CTA, member count display, updated error copy |
| `pages/join/course/[token].tsx` | Add `getServerSideProps` for public preview, unauthenticated CTA, updated error copy |
| `pages/api/join/lookup.ts` | Add `member_count` to response |
| `pages/api/groups/[id]/reset-invite.ts` | New endpoint |
| `pages/api/courses/[id]/reset-invite.ts` | New endpoint |
| `pages/group/[id].tsx` | Add Reset link button near Copy link |
| `pages/teacher/course/[id]/index.tsx` | Add Reset link button near Copy link |

---

## Success Criteria

1. Unauthenticated user clicking a group or course invite link sees the group/course name before any login prompt
2. Group lead can reset their group invite token from the group page
3. Teacher can reset the course invite token from the course page
4. Group join page shows current member count
5. Invalid link screens show actionable copy directing users to the right person
