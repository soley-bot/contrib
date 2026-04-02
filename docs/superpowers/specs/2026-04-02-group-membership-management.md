# Group Membership & CRUD Integrity — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Problem

The current codebase has two classes of issues:

**A. Group membership model is broken:**
1. Invite links are the only way to add members. Teachers see ungrouped students but can't assign them.
2. Teacher-as-temporary-lead hack is fragile (auto-transfer to first student who joins).
3. Multi-table mutations happen client-side with no transaction (4 separate inserts for group creation).
4. No `created_by` field — can't tell who originally created a group.

**B. CRUD operations violate core constraints (found in full audit):**
5. Group delete hard-deletes tasks + evidence via CASCADE (violates "evidence immutable" + "soft delete tasks").
6. Course delete hard-deletes evidence, task_comments, activity_log.
7. Account deletion blocked by 10 NO ACTION FK constraints — no user can ever delete their account.
8. `invite_token` leaked in `use-course.ts` select, 8 instances of `select('*')` across hooks.
9. Race condition in join group allows exceeding 6-member limit.
10. `edit-task-modal` allows any group member to change `assignee_id` (task hijacking).
11. Notification/activity_log inserts are fire-and-forget (13+ silent failures).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Teacher control level | Full (assign, move, remove) | Teacher is the authority for course-linked groups |
| Lead can add directly? | Yes, from course roster | Reduces friction, lead picks enrolled students |
| Teacher picks lead at creation? | Yes | Eliminates auto-transfer hack entirely |
| Standalone groups? | Keep them | Students may use Contrib without a teacher |
| Direct-add for standalone groups? | No — invite link only | No course roster to pick from |
| Course enrollment method | Invite link only | High-volume, privacy concerns with search |
| API route pattern | One route = one responsibility | Multi-table mutations server-side with adminClient |
| Multi-group per course? | No — one group per course per student | Matches real group projects; avoids peer review confusion |
| Course leave + group? | Remove from group on course leave | Prevents ghost members invisible to teacher |
| Group deletion? | Archive (soft-delete), never hard delete | Preserves evidence and contribution history |

---

## Part 1: Database Changes

### 1a. New column: `groups.created_by`

```sql
ALTER TABLE groups ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
UPDATE groups SET created_by = lead_id WHERE created_by IS NULL;
```

`ON DELETE SET NULL` so group survives if creator's account is deleted.

### 1b. New activity action: `member_added`

```sql
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_action_check
  CHECK (action IN ('task_created','task_assigned','task_done','file_uploaded',
    'member_joined','member_left','member_removed','member_added',
    'lead_transferred','group_updated','group_archived',
    'evidence_added','evidence_updated','evaluation_opened',
    'evaluation_submitted','evaluation_reset','blocker_declared',
    'task_comment_added','report_shared'));
```

### 1c. Update `rls-policies-live.sql` with all changes

---

## Part 2: New API Routes (Group Membership)

### `POST /api/groups/create`

Replaces client-side multi-insert in `dashboard.tsx` and `teacher/course/[id]/index.tsx`.

- **Auth:** Authenticated user
- **Input:** `{ name, subject, dueDate?, courseId?, leadId? }`
- **Validation:** Zod; if courseId: caller is course member or teacher; if leadId: target in course_members
- **Does atomically:** INSERT groups + group_members + activity_log + UPSERT course_members
- **Returns:** `{ group }` or `{ error }`

### `POST /api/groups/[id]/add-member`

Teacher assigns student OR lead adds from course roster.

- **Auth:** Course teacher OR group lead
- **Input:** `{ profileId }`
- **Validation:** group has course_id; target in course_members; not already in group; not in another group in same course; group < 6 (checked in transaction)
- **Does:** INSERT group_members + activity_log (member_added) + notification
- **Returns:** `{ success }` or `{ error }`

### `GET /api/groups/[id]/eligible-members`

Returns enrolled students not in any group in this course. Solves RLS gap (leads can't read other students' course_members).

- **Auth:** Course teacher OR group lead
- **Returns:** `{ members: Profile[] }`

### `POST /api/groups/[id]/remove-member`

Teacher removes student from group.

- **Auth:** Course teacher
- **Input:** `{ profileId }`
- **Validation:** target is member; target is NOT the lead; reassign their tasks to lead
- **Does:** DELETE group_members + reassign tasks + activity_log (member_removed) + notification

### `POST /api/groups/[id]/join`

Replaces client-side join in `pages/join/[token].tsx`.

- **Auth:** Authenticated student
- **Validation:** not teacher; not already member; not in another group in same course; group < 6 (in transaction)
- **Does:** INSERT group_members + activity_log + notification + UPSERT course_members + Telegram notify

### DELETE: `POST /api/groups/[id]/auto-transfer-lead`

No longer needed. Teacher picks a real student as lead at creation.

---

## Part 3: Delete/Archive Fixes (CRUD Violations)

### 3a. Group delete → archive

Replace hard delete with `archived_at` soft-delete everywhere:

- **`group/[id].tsx` `executeDeleteGroup`**: Change from `supabase.from('groups').delete()` to `supabase.from('groups').update({ archived_at: new Date().toISOString() })`
- **`teacher/course/[id]/index.tsx` `handleDeleteGroup`**: Same change
- **`group/[id].tsx` `executeLeaveGroup` (last member)**: Same — archive instead of delete
- **RLS**: Add `archived_at IS NULL` filter to groups SELECT policy
- **Hooks**: Add `.is('archived_at', null)` to all group queries

This preserves all tasks, evidence, activity history, and peer reviews.

### 3b. Course delete refactor

Refactor `api/courses/[id]/delete.ts`:

| Current (WRONG) | Fixed |
|---|---|
| Hard-delete evidence | Soft-delete: `.update({ deleted_at })` (add column to evidence table) |
| Hard-delete task_comments | Soft-delete: `.update({ deleted_at })` (column already exists) |
| Hard-delete activity_log | Keep as-is (or soft-delete — design choice) |
| Hard-delete groups | Archive: `.update({ archived_at })` |
| Hard-delete group_members | Keep (membership data, not contribution data) |
| Hard-delete course_members | Keep |

**New migration:** Add `deleted_at` column to `evidence` table:
```sql
ALTER TABLE evidence ADD COLUMN deleted_at timestamptz;
```

### 3c. Evidence soft-delete filter

Add `.is('deleted_at', null)` to all evidence SELECT queries. Update RLS policy.

---

## Part 4: Read Fixes (Data Leaks)

### 4a. Fix `invite_token` leak

**`hooks/use-course.ts:30`**: Remove `invite_token` from select:
```
.select('id, name, subject, teacher_id, created_at')
```

### 4b. Fix all `select('*')` violations (8 instances)

| File | Fix |
|---|---|
| `hooks/use-courses.ts:41` | Explicit columns (exclude invite_token) |
| `hooks/use-user.ts:42` | Explicit profile columns |
| `hooks/use-notifications.ts:48` | Explicit notification columns |
| `hooks/use-evaluation-session.ts:47` | Explicit columns |
| `hooks/use-evaluation-summaries.ts:44` | Explicit columns |
| `teacher/course/[id]/index.tsx:106` | Explicit profile columns for ungrouped |
| `teacher/course/[id]/index.tsx:182` | Explicit eval summary columns |
| `teacher/course/[id]/index.tsx:66` | Explicit profile columns in group members |

### 4c. Fix N+1 in cron job

**`api/cron/daily.ts:260`**: Add `assignee_id` to initial task select to avoid per-task refetch.

---

## Part 5: Update Fixes (Auth Gaps)

### 5a. Task edit authorization

**`components/edit-task-modal.tsx`**: Add code-level guard before update:
```ts
if (!isLead && task.assignee_id !== userId) return;
```
RLS should catch this, but defense in depth.

### 5b. Group edit authorization

**`components/edit-group-modal.tsx`**: Add `.eq('lead_id', userId)` to update query as atomic guard.

### 5c. Notification preferences whitelist

**`pages/profile.tsx`**: Whitelist allowed columns:
```ts
const ALLOWED = ['notify_contributions','notify_blockers','notify_deadlines','notify_weekly_digest'];
if (!ALLOWED.includes(column)) return;
```

---

## Part 6: UI Changes

### Teacher: Create Group Modal
- Add "Group lead" dropdown (enrolled students from course_members)
- `created_by = teacher.id`, `lead_id = selected student`
- Call `POST /api/groups/create`

### Teacher: Ungrouped Students
- "Assign to group" button per student → group dropdown → `POST /api/groups/[id]/add-member`

### Teacher: Group Detail
- "Remove" button per non-lead member → confirm modal → `POST /api/groups/[id]/remove-member`

### Student: Group Members Tab
- "Add member" button for leads of course-linked groups
- Modal fetches `GET /api/groups/[id]/eligible-members`
- On select: `POST /api/groups/[id]/add-member`

### Student: Dashboard
- Replace 4-step client-side insert with `POST /api/groups/create`

### Student: Join Page
- Replace client-side join with `POST /api/groups/[id]/join`
- Remove auto-transfer-lead call

---

## Edge Cases Handled

| Edge Case | Fix |
|-----------|-----|
| Lead can't read course roster (RLS) | `GET /api/groups/[id]/eligible-members` server-side |
| Race condition: 7th member | Count inside transaction in add-member/join APIs |
| `activity_log` CHECK rejects `member_added` | ALTER constraint in migration |
| `created_by` FK on user deletion | `ON DELETE SET NULL` |
| Student in multiple groups per course | Enforce one-group-per-course in APIs |
| Student leaves course but stays in group | Course leave cascades to group removal |
| Group delete destroys evidence/tasks | Archive instead of delete |
| Course delete destroys evidence | Soft-delete evidence (new `deleted_at` column) |
| Removed member's tasks orphaned | Reassign to lead on removal |
| Task hijacking via edit modal | Add code-level auth guard |
| Notification pref column injection | Whitelist allowed columns |

---

## Files to Modify

| File | Change |
|------|--------|
| `database/rls-policies-live.sql` | `created_by`, evidence `deleted_at`, action CHECK, archived_at filter |
| `types/index.ts` | Add `created_by` to Group, `deleted_at` to Evidence |
| `pages/api/groups/create.ts` | **NEW** — server-side group creation |
| `pages/api/groups/[id]/add-member.ts` | **NEW** — direct member add |
| `pages/api/groups/[id]/remove-member.ts` | **NEW** — teacher removes member |
| `pages/api/groups/[id]/join.ts` | **NEW** — server-side join |
| `pages/api/groups/[id]/eligible-members.ts` | **NEW** — fetch addable students |
| `pages/api/groups/[id]/auto-transfer-lead.ts` | **DELETE** |
| `pages/api/courses/[id]/delete.ts` | Refactor: soft-delete evidence/comments, archive groups |
| `pages/dashboard.tsx` | Use `/api/groups/create` |
| `pages/join/[token].tsx` | Use `/api/groups/[id]/join`, remove auto-transfer |
| `pages/teacher/course/[id]/index.tsx` | Lead picker, assign ungrouped, use API |
| `pages/teacher/course/[id]/group/[groupId].tsx` | Remove member button |
| `pages/group/[id].tsx` | Archive instead of delete, fix leave flow |
| `components/group-members-tab.tsx` | "Add member" button for leads |
| `components/add-member-modal.tsx` | **NEW** — enrolled student picker |
| `components/assign-group-modal.tsx` | **NEW** — group picker for ungrouped students |
| `components/edit-task-modal.tsx` | Add auth guard for assignee changes |
| `components/edit-group-modal.tsx` | Add lead_id atomic guard |
| `pages/profile.tsx` | Whitelist notification pref columns |
| `hooks/use-course.ts` | Remove invite_token from select |
| `hooks/use-courses.ts` | Explicit columns (no select *) |
| `hooks/use-user.ts` | Explicit columns |
| `hooks/use-notifications.ts` | Explicit columns |
| `hooks/use-evaluation-session.ts` | Explicit columns |
| `hooks/use-evaluation-summaries.ts` | Explicit columns |
| `hooks/use-groups.ts` | Add archived_at filter |
| `pages/api/cron/daily.ts` | Add assignee_id to initial select (fix N+1) |
| `lib/validation.ts` | Zod schemas for new API inputs |

---

## Verification

1. Run migration in Supabase (created_by, evidence deleted_at, action CHECK)
2. `npx tsc --noEmit` — no type errors
3. `npm run build` — clean build
4. Test: Teacher creates group with student lead → student is lead, no auto-transfer
5. Test: Teacher assigns ungrouped student → student appears in group
6. Test: Lead adds enrolled student via "Add member" → student joins
7. Test: Teacher removes student → student moves to ungrouped, tasks reassigned
8. Test: Student creates standalone group → invite link only, no "Add member"
9. Test: Student joins via invite link → server-side, course_members upserted
10. Test: Student already in Group A → add to Group B same course → error
11. Test: Student leaves course → automatically removed from group
12. Test: Race condition → two simultaneous adds to 5-member group → only one succeeds
13. Test: Lead/teacher deletes group → archived, not hard-deleted, evidence preserved
14. Test: Teacher deletes course → evidence soft-deleted, tasks soft-deleted, groups archived
15. Test: `select('*')` removed from all hooks — check via grep
16. Test: Edit task as non-assignee/non-lead → blocked
