# Pre-Production QA Plan — Contrib Public Launch

**Date:** 2026-04-02
**Goal:** Ensure Contrib is ready for public launch (marketing push, open signups, needs to be solid from day one)
**Current state:** 13 pages, 17 API routes, 24 hooks, 39 components. 7 unit tests (lib only). No CI/CD. Sentry live. No component/integration tests.

---

## Phase 1: Critical Infrastructure (Do First)

### 1.1 Rate Limiting — Migrate to Upstash Redis
**Why:** In-memory rate limiting resets on every cold start. A single attacker can bypass it trivially on serverless.
**What:**
- [ ] Set up Upstash Redis via Vercel Marketplace
- [ ] Replace `lib/rate-limit.ts` in-memory Map with Upstash `@upstash/ratelimit`
- [ ] Apply to all 17 API routes (already have `rateLimit()` calls — just swap the backend)
- [ ] Test: hit an endpoint 60+ times rapidly, confirm it blocks

### 1.2 RLS Tightening (3 Known Gaps)
**Why:** Currently any authenticated user can read all profiles and all courses (including invite tokens).
**What:**
- [ ] **Profiles SELECT:** Restrict to own profile + group co-members + course co-members + course teachers
- [ ] **Courses SELECT:** Restrict to teacher owner + enrolled students (via course_members). Create a DB view or column-level security to hide invite_token from students
- [ ] **Verify all 15 tables** have appropriate RLS for SELECT, INSERT, UPDATE, DELETE
- [ ] Test: log in as Student A, try to query Student B's profile who shares no group/course

### 1.3 Error Boundary + Offline Handling
**Why:** If any page crashes, the user sees a white screen. No graceful degradation.
**What:**
- [ ] Add React error boundary wrapper component (catches render errors, shows "Something went wrong" with retry)
- [ ] Wrap `_app.tsx` with the error boundary
- [ ] Add `pages/404.tsx` with brand-consistent "Page not found" design
- [ ] Test: throw an error in a component, confirm error boundary catches it

### 1.4 CI/CD Pipeline
**Why:** No automated checks. A broken build can ship to production on any push.
**What:**
- [ ] GitHub Actions workflow: on push/PR to main → `npm ci` → `npx tsc --noEmit` → `vitest run` → `npm run build`
- [ ] Block merge if any step fails
- [ ] Vercel preview deployments on PRs (already enabled by default)

---

## Phase 2: Functional Testing (Every User Flow)

### 2.1 Auth Flows
- [ ] **Signup:** new email → confirm password → onboarding → dashboard
- [ ] **Login:** existing email → dashboard (student) or /teacher (teacher)
- [ ] **Forgot password:** request → email received → reset → login works
- [ ] **OAuth callback:** if enabled, test Google/GitHub login
- [ ] **Session expiry:** leave tab open 2+ hours, confirm graceful re-auth
- [ ] **Role switch:** student → teacher (with no groups) → back to student
- [ ] **Role lock:** student with active groups cannot switch to teacher

### 2.2 Student Flows
- [ ] **Join course:** use invite link → enrolled → see course on dashboard
- [ ] **Create group in course:** must select course → group appears under course
- [ ] **Join group via invite:** use link → member of group → see group page
- [ ] **Already a member:** use same link → "already a member" screen
- [ ] **Create task:** title + assignee + type → appears in kanban → activity logged
- [ ] **Complete task:** move to done → activity logged → contribution count updates
- [ ] **Log evidence:** note, link, shared file → attached to task → immutable
- [ ] **Evidence versioning:** edit evidence → new version created, old preserved
- [ ] **Task comments:** post → visible to group → author can delete → lead can delete
- [ ] **Heads Up (blocker):** declare → in-app notification to all members → Telegram fires
- [ ] **Peer review:** open session → all members rate each other → anonymous averages shown
- [ ] **Export PDF:** generate → 6 themes → download works → content is correct
- [ ] **Share report:** generate link → open in incognito → data visible without auth
- [ ] **Revoke report:** delete share → link returns 404
- [ ] **Leave group (non-lead):** leave → removed from members → redirected to dashboard
- [ ] **Leave group (lead, others exist):** blocked → must transfer first
- [ ] **Leave group (lead, solo):** group fully deleted
- [ ] **Transfer leadership:** lead transfers to another member → new lead has full controls

### 2.3 Teacher Flows
- [ ] **Create course:** name + subject → appears on teacher dashboard
- [ ] **Create group in course:** name + subject → teacher is temp lead
- [ ] **Share course invite:** copy link → student joins via link
- [ ] **Share group invite:** copy link → student joins → auto-transfer fires → teacher removed from group_members → student becomes lead
- [ ] **View course groups:** all linked groups visible with member counts
- [ ] **Drill into group:** see members, tasks, activity, completion %
- [ ] **Edit group:** rename → change reflects
- [ ] **Delete course:** confirmation → cascades (groups, tasks, evidence, members all deleted)
- [ ] **Ungrouped students:** students enrolled in course but not in any group → visible in course detail
- [ ] **Weekly digest:** (test via manual cron trigger) → Telegram message received

### 2.4 Telegram Flows
- [ ] **Connect:** profile → click Connect → get code → open t.me link → send code → connected
- [ ] **Notification preferences:** toggle off "Contributions" → create a task → no Telegram notification
- [ ] **Toggle back on:** receive notifications again
- [ ] **Disconnect:** click disconnect → stop receiving all notifications
- [ ] **Long message:** trigger a notification > 4096 chars → message splits correctly
- [ ] **Bot commands:** send /start, /help, random text to bot → correct responses

### 2.5 Cross-Role Edge Cases
- [ ] **Teacher uses group invite link:** blocked ("Teachers cannot join student groups")
- [ ] **Student accesses /teacher URL:** redirected to /dashboard
- [ ] **Student accesses another student's group URL:** "not a member" screen
- [ ] **Two students join teacher-created group simultaneously:** only one gets lead, other joins normally
- [ ] **Student enrolled in 2+ courses creates group:** must pick one, can't skip

---

## Phase 3: Security Testing

### 3.1 API Security Sweep
- [ ] Every API route has auth check (getUserFromApiRoute) — except intentionally public ones
- [ ] Every API route has rate limiting
- [ ] Every API route validates input with Zod
- [ ] No API route returns more data than needed (no select('*') with sensitive fields)
- [ ] Test: call every API route without auth → all return 401
- [ ] Test: call every API route with wrong method → all return 405

### 3.2 IDOR Testing
- [ ] Can Student A modify Student B's task? (should fail)
- [ ] Can Student A delete Student B's comment? (should fail — RLS enforces)
- [ ] Can Student A post a blocker to a group they're not in? (should fail)
- [ ] Can Student A access a group they're not in via URL? (should show "not a member")
- [ ] Can a teacher modify another teacher's course? (should fail)

### 3.3 Input Validation
- [ ] Task title: empty → blocked, >300 chars → blocked
- [ ] Evidence: empty → blocked, >2000 chars → blocked, invalid URL → blocked
- [ ] Comment: empty → blocked
- [ ] Group name: empty → blocked, XSS attempt → escaped/blocked
- [ ] Course name: empty → blocked
- [ ] Blocker reason: empty → blocked

### 3.4 CSP and Headers
- [ ] Check CSP headers in production (next.config.ts)
- [ ] No inline scripts or styles that violate CSP
- [ ] X-Frame-Options, X-Content-Type-Options present
- [ ] HTTPS enforced (Vercel handles this)

---

## Phase 4: Performance and Scale

### 4.1 Database Performance
- [ ] Check indexes on frequently queried columns: `group_members.group_id`, `group_members.profile_id`, `tasks.group_id`, `activity_log.group_id`, `notifications.recipient_id`, `courses.teacher_id`, `course_members.course_id`
- [ ] Test with 50+ groups, 200+ tasks, 500+ activity entries — page load < 2s
- [ ] Check for N+1 queries (especially teacher dashboard counting members per group)

### 4.2 Realtime Subscriptions
- [ ] Open group page in 2 browsers → create task in one → appears in other within 2s
- [ ] Open dashboard → receive notification → bell updates without refresh
- [ ] Check subscription cleanup: navigate away from group → subscription closed (no memory leak)

### 4.3 Bundle Size
- [ ] Run `npm run build` → check page sizes in output
- [ ] Largest pages (group/[id].tsx at ~900 lines) should still load < 3s on 3G
- [ ] No unnecessary imports (tree-shaking working)

### 4.4 Serverless Cold Starts
- [ ] Test API routes after 10+ minutes of inactivity → response time < 3s
- [ ] Telegram webhook responds within 5s timeout (already has AbortController)

---

## Phase 5: UX Polish

### 5.1 Loading States
- [ ] Every page shows spinner/skeleton while loading (never blank white screen)
- [ ] Every async button shows loading state (never feels unresponsive)
- [ ] Error states show user-friendly messages (never raw Supabase errors)

### 5.2 Empty States
- [ ] Dashboard with no groups → friendly empty state with CTA
- [ ] Group with no tasks → friendly empty state
- [ ] Teacher dashboard with no courses → friendly empty state with illustration
- [ ] Notifications bell with no notifications → "No notifications yet"

### 5.3 Responsive Design
- [ ] Test every page on mobile (375px width)
- [ ] Test every page on tablet (768px)
- [ ] Test every page on desktop (1440px)
- [ ] Bottom nav on mobile doesn't overlap content
- [ ] Modals are scrollable on small screens
- [ ] PDF export works on mobile

### 5.4 Accessibility Basics
- [ ] All interactive elements have focus styles
- [ ] Modals trap focus
- [ ] Toggle switches have aria-checked
- [ ] Images/icons have alt text or aria-label
- [ ] Color contrast meets WCAG AA (brand blue #1A56E8 on white = 4.6:1, passes)

### 5.5 Browser Testing
- [ ] Chrome (latest)
- [ ] Safari (latest — test on real Mac/iPhone if possible)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Android

---

## Phase 6: Monitoring and Observability

### 6.1 Sentry Setup
- [ ] Verify error tracking works: throw a test error → appears in Sentry dashboard
- [ ] Set up Sentry alerts: email on new error types
- [ ] Verify source maps are uploaded (readable stack traces)
- [ ] Check tracesSampleRate is appropriate for launch traffic (currently 0.1 client, 0.05 server)

### 6.2 Vercel Analytics
- [ ] Enable Web Analytics (page views, visitors)
- [ ] Enable Speed Insights (Core Web Vitals)
- [ ] Set up alerts for high error rates

### 6.3 Uptime Monitoring
- [ ] Set up a simple uptime check (ping /api/cron/daily health or landing page every 5 min)
- [ ] Alert on downtime (email or Telegram)

---

## Phase 7: Pre-Launch Checklist

### 7.1 Data
- [ ] Clean up remaining test data (we started this today)
- [ ] Verify all real user data is intact
- [ ] Backup database before launch

### 7.2 DNS and Domain
- [ ] joincontrib.com resolves correctly
- [ ] SSL certificate valid
- [ ] www → non-www redirect (or vice versa)

### 7.3 SEO Basics
- [ ] Landing page has proper meta title and description
- [ ] OG image configured for social sharing
- [ ] robots.txt allows indexing of landing page, blocks /dashboard, /group, /teacher

### 7.4 Legal
- [ ] Privacy policy (especially re: Telegram data, student names)
- [ ] Terms of service
- [ ] Cookie consent (if using analytics cookies)

### 7.5 Final Smoke Test
- [ ] Complete Flow 1: signup → create course (teacher) → share invite → join course (student) → create group → create task → log evidence → peer review → export PDF
- [ ] Complete Flow 2: teacher creates group → shares invite → student joins → auto-transfer → teacher sees group in dashboard
- [ ] Telegram: connect → receive notification → toggle preference off → confirm no notification
- [ ] Public report: share → open in incognito → data shows → revoke → 404

---

## Priority Order for Implementation

| Priority | Phase | Effort | Impact |
|---|---|---|---|
| P0 | 1.1 Upstash Redis rate limiting | 2-3 hours | Blocks abuse at scale |
| P0 | 1.2 RLS tightening | 2-3 hours | Data privacy |
| P0 | 1.4 CI/CD pipeline | 1-2 hours | Prevents shipping broken builds |
| P1 | 2.x Functional testing (manual) | 4-6 hours | Catches remaining bugs |
| P1 | 3.x Security testing | 2-3 hours | Prevents embarrassing breaches |
| P1 | 1.3 Error boundary | 1 hour | Prevents white screens |
| P2 | 4.x Performance | 2-3 hours | Good UX at scale |
| P2 | 5.x UX polish | 3-4 hours | Professional feel |
| P2 | 6.x Monitoring | 1-2 hours | See problems fast |
| P3 | 7.x Pre-launch checklist | 2-3 hours | Final sweep |

**Total estimated effort: ~25-35 hours of work**
