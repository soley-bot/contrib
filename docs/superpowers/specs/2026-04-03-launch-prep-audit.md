# Launch Prep: Full Bug Audit + Teacher Flow Polish

**Date:** 2026-04-03
**Context:** Contrib is ready for its first real pilot — a specific teacher's class. Five major development phases are complete (P0-P3 QA done). The goal is to ensure nothing breaks and the teacher experience is smooth before handing the app over.

**Launch target:** Single teacher's class at a Cambodian university
**Success criteria:** Teacher can create a course, invite students, monitor groups, and drill down into progress without hitting errors or confusion.

---

## Phase 1: Automated Checks

Run baseline automated checks to catch low-hanging issues before manual review.

- `tsc --noEmit` — catch TypeScript errors
- `next build` — catch SSR/import/build issues
- Fix all errors before proceeding to manual review

---

## Phase 2: Parallel Bug Audit (Agent Team)

4 review agents working in parallel, each covering a domain:

### Agent 1: API Routes + Auth/Security
- All 22 API endpoints in `pages/api/`
- Auth checks present and correct (requireAuth, requireStudent, requireTeacher)
- Rate limiting applied where needed
- Error responses consistent (proper status codes, helpful messages)
- Edge cases: empty inputs, duplicate actions, concurrent requests
- RLS gaps: `profiles` SELECT too broad, `courses` SELECT exposes invite tokens

### Agent 2: Hooks + Real-time Subscriptions
- All 24 hooks in `hooks/`
- Loading/error states handled in every hook
- Real-time subscription cleanup (no memory leaks)
- Cache invalidation correct after mutations
- Race conditions in concurrent updates

### Agent 3: Student-Facing Pages + Components
- Pages: dashboard, group/[id], join flows, profile, onboarding, report
- Components: task cards, evidence forms, evaluation, timeline, modals
- Empty states, error states, loading skeletons
- Responsive behavior on mobile
- Navigation edge cases (back button, refresh, deep links)

### Agent 4: Teacher-Facing Pages + Components
- Pages: teacher dashboard, course/[id], group drill-down
- Course creation flow, invite link generation/copy
- Group list with progress indicators
- Read-only drill-down (verify no accidental edit capabilities)
- Course analytics accuracy
- Empty states (no courses, no groups, no students)

**Severity levels:**
- **P0 Critical:** App crashes, data loss, security holes → fix immediately
- **P1 Important:** Broken flows, wrong data, confusing UX → fix before launch
- **P2 Minor:** Polish issues, minor inconsistencies → log, fix if time permits

---

## Phase 3: Teacher Flow Walkthrough

End-to-end trace of the 4 key teacher moments:

### Moment 1: First Login as Teacher
- Sign up → onboarding → role = teacher → `/teacher` dashboard
- Empty state should be helpful with clear CTA

### Moment 2: Create Course + Invite Students
- Create course → generate invite link → copy link
- Students join via link → teacher sees them appear
- Invite link regeneration works

### Moment 3: Students Form Groups
- Teacher creates groups with lead picker
- Ungrouped students visible and assignable
- Group formation progress visible to teacher

### Moment 4: Monitor Progress
- Course analytics (completion rates, active vs stalled)
- Group progress bars
- Drill-down: tasks, timeline, peer review (read-only)
- Data accuracy verified

---

## Phase 4: RLS Tightening

Fix known security gaps flagged in CLAUDE.md as "before scaling":

- **`profiles` SELECT:** Currently too broad — tighten to only expose necessary fields
- **`courses` SELECT:** Exposes `invite_token` to all course members — restrict to teacher only
- **`notifications`:** Review SELECT policy scope
- Verify fixes by testing as different roles (student, teacher, unauthenticated) via Supabase SQL editor
- Update `database/rls-policies-live.sql` to reflect any policy changes

---

## Phase 5: Final Verification

- Clean `next build` with no errors
- `tsc --noEmit` passes
- No console warnings in dev mode
- Spot-check critical flows in browser

---

## Out of Scope

- No new features (task comments, email notifications, PWA — all deferred)
- No refactoring unless it fixes a bug
- No cosmetic changes unless they affect usability
- P2 issues logged but not necessarily fixed
