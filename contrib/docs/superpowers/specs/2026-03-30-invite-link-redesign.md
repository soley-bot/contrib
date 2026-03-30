# Invite Link Redesign — Design Spec
**Date:** 2026-03-30
**Status:** Ready for implementation
**Approach:** Option A — Surgical fixes to existing join pages

---

## Problem

Contrib has two invite link types: group join (`/join/[token]`) and course linking (`/join/course/[token]`). Both have the same core UX gap: unauthenticated users are immediately redirected to `/signup` with no context about what they're joining. This causes drop-off and confusion. Additional gaps: no way to reset/revoke a leaked token, no member count shown on join pages, and unhelpful error copy on invalid links.

---

## Scope

Four targeted improvements to the existing join flow. No architectural changes — the two-page URL structure (`/join/[token]` vs `/join/course/[token]`) is correct and stays.

---

## Change 1 — Unauthenticated Preview on Join Pages

Both join pages must show group/course info to unauthenticated users before asking them to log in.

### Approach

Move the token lookup to `getServerSideProps` so the page renders with data for everyone. Auth state is checked client-side to show the correct CTA.

**Important:** `getServerSideProps` must NOT call the `/api/join/lookup` HTTP endpoint — doing so routes all requests through Vercel's outbound IP, breaking the per-user rate limit. Instead, inline the Supabase query directly in `getServerSideProps`.

### `/join/[token]` — group join page

`getServerSideProps` inlines this query (no auth needed — anon key, RLS allows public read of `groups` via `invite_token`):
```ts
const { data: group } = await supabase
  .from('groups')
  .select('id, name, subject, lead_id')
  .eq('invite_token', token)
  .single();

const { count: memberCount } = await supabase
  .from('group_members')
  .select('id', { count: 'exact', head: true })
  .eq('group_id', group.id);
```

Pass `{ group: { id, name, subject, lead_id, memberCount } }` as props. If token not found, pass `{ notFound: true }` and render the not-found state — no redirect.

Remove the client-side `if (status === 'loading' || userLoading)` loading guard from rendering the join card. The card is server-rendered with real data and must be visible immediately. Only show a loading state for the **CTA area** while `userLoading` is true (e.g. a skeleton button), so the preview is always visible.

Client-side CTA logic:
- `userLoading` → skeleton/disabled button
- `!user` → "Sign up to join" (primary) + "Already have an account? Log in" (text link)
- `user` → existing "Join group" button flow

### `/join/course/[token]` — course linking page

`getServerSideProps` inlines this query using the **anon key** (requires a permissive RLS policy on `courses` — see DB section below):
```ts
const { data: course } = await supabase
  .from('courses')
  .select('id, name, subject')
  .eq('invite_token', token)
  .single();
```

Pass `{ course: { id, name, subject } }` as props. Remove client-side fetch of course data — use props instead.

Client-side CTA logic:
- `userLoading` → skeleton button
- `!user` → "Sign up to link your group" (primary) + "Already have an account? Log in" (text link). **Note:** a new user who signs up will have no groups yet — after onboarding they'll land back on this page and see the "Create a new group" branch. This is acceptable — the CTA sets correct expectations for leads, and the post-signup flow already handles the empty-group state.
- `user` → existing group selector / lead flow

### DB: RLS policy for public course read

The `courses` table must allow unauthenticated reads of `(id, name, subject)` by invite token. Add:
```sql
CREATE POLICY "Public course preview by token"
  ON courses FOR SELECT
  USING (true);
```
Or scope it more tightly if needed — the important thing is that anon key can SELECT from `courses`.

### `returnTo` flow

The existing `returnTo` redirect through signup/auth/onboarding is already correct after recent fixes. No change needed.

---

## Change 2 — Member Count on Group Join Page

Add current member count to the group join card. Shown to all users (authenticated and unauthenticated).

**Data source:** Fetched in `getServerSideProps` alongside the group lookup (see Change 1 — two separate queries required since Supabase JS SDK does not support inline `COUNT` aggregates in a single `select` call).

**Display:**
- Dot indicators: filled brand-colored dots for current members, muted dots for remaining slots (6 max)
- Text label: "2 / 6 members"

Positioned between the group subject and the CTA button. No change to the existing group-full screen.

---

## Change 3 — Reset Invite Link

Group leads and teachers can regenerate their invite token. Old token becomes invalid immediately.

### UI placement

**Group page** (`components/invite-banner.tsx`): Add `onReset?: () => void` prop. When provided, render a "Reset link" text button next to "Copy link". The parent page (`pages/group/[id].tsx`) passes `onReset` and handles the API call + local state update:
```ts
// After successful reset:
setGroup(prev => ({ ...prev, invite_token: newToken }));
```
`InviteBanner` derives the displayed link from `token` prop — updating parent state propagates automatically.

**Teacher course page** (`pages/teacher/course/[id]/index.tsx`): Add "Reset link" text button inline next to "Copy link" inside the existing invite box. On success, update `courseInviteLink` via `setCourse(prev => ({ ...prev, invite_token: newToken }))` in local state.

### UX behaviour

- Button: **"Reset link"** — muted text style, no destructive color (it's a utility action)
- On click: inline confirmation text replaces the button: "This will break the current link. Confirm reset?" with [Confirm] [Cancel]
- On confirm: call API, update displayed URL in local state, show brief inline "Link reset" message for 2 seconds
- On error: show inline error message

### API endpoints

**`POST /api/groups/[id]/reset-invite`**
- Auth: session required, must be `groups.lead_id`
- Action: `UPDATE groups SET invite_token = gen_random_uuid() WHERE id = $id RETURNING invite_token`
- Returns: `{ invite_token: string }`
- Rate limit: best-effort, using existing in-memory rate limiter (5 per groupId per minute). Note: in-memory limits are per serverless instance and will not enforce perfectly across cold starts — sufficient for abuse prevention, not a hard guarantee.

**`POST /api/courses/[id]/reset-invite`**
- Auth: session required, must be `courses.teacher_id`
- Action: `UPDATE courses SET invite_token = gen_random_uuid() WHERE id = $id RETURNING invite_token`
- Returns: `{ invite_token: string }`
- Rate limit: same as above

### Token format

`gen_random_uuid()` at the DB level. No expiry — permanent until manually reset.

---

## Change 4 — Better Error Copy on Invalid Links

| Page | Current | New |
|------|---------|-----|
| `/join/[token]` | "This invite link is invalid or has been removed." | "This link is no longer valid. Ask your group lead for a new invite link." |
| `/join/course/[token]` | "This invite link is invalid or has been removed." | "This link is no longer valid. Ask your teacher for a new course link." |

No other changes to the not-found screen layout.

---

## What Is Not In Scope

- Link expiry dates
- Approval flows / join requests
- Per-link max-use caps (6-member limit already handles this for groups)
- Open Graph preview tags for WhatsApp/Telegram sharing
- Email invites

---

## Files Affected

| File | Change |
|------|--------|
| `pages/join/[token].tsx` | Add `getServerSideProps` with inline query, unauthenticated CTA, member count display, remove loading guard from card render, updated error copy |
| `pages/join/course/[token].tsx` | Add `getServerSideProps` with inline query, unauthenticated CTA, updated error copy |
| `components/invite-banner.tsx` | Add `onReset?: () => void` prop and Reset link button |
| `pages/group/[id].tsx` | Pass `onReset` to `InviteBanner`, handle API call and local state update |
| `pages/teacher/course/[id]/index.tsx` | Add Reset link button inline in invite box, handle API call and local state update |
| `pages/api/groups/[id]/reset-invite.ts` | New endpoint |
| `pages/api/courses/[id]/reset-invite.ts` | New endpoint |
| DB migration | Add permissive SELECT policy on `courses` table for anon reads |

---

## Success Criteria

1. Unauthenticated user clicking a group or course invite link sees the group/course name before any login prompt
2. Group join page shows current member count (dots + text)
3. Group lead can reset their group invite token from the group page; old link stops working immediately
4. Teacher can reset the course invite token from the course page; old link stops working immediately
5. Invalid link screens show actionable copy directing users to the right person
