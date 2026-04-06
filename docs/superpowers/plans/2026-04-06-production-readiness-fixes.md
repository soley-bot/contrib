# Production Readiness Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, high, and medium bugs from the production readiness audit (15 fixes across 20 files).

**Architecture:** Surgical fixes to existing files following established patterns. Two new API routes follow the standard template in CLAUDE.md. One new shared constant file. No refactoring beyond what each fix requires.

**Tech Stack:** Next.js Pages Router, Supabase, TypeScript, Zod, Sentry, Upstash Redis rate limiting

**Important:** All file paths are relative to `contrib/` (the app root). The project root is `C:/Users/USer/Desktop/Dev Projects/Contrib/`.

---

### Task 1: Create shared profile columns constant (Fix 1 prerequisite)

**Files:**
- Create: `contrib/lib/columns.ts`

- [ ] **Step 1: Create `lib/columns.ts`**

```ts
/**
 * Shared column lists for Supabase selects.
 * Prevents wildcard selects from leaking sensitive or unnecessary columns.
 */
export const PROFILE_SELECT = 'id, name, university, faculty, year_of_study, avatar_url, role';
```

- [ ] **Step 2: Verify the file is importable**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/lib/columns.ts && git commit -m "feat: add shared PROFILE_SELECT constant to prevent wildcard selects"
```

---

### Task 2: Replace wildcard selects in hooks (Fix 1 + Fix 2 + Fix 3)

**Files:**
- Modify: `contrib/hooks/use-tasks.ts:43-46`
- Modify: `contrib/hooks/use-evidence.ts:40-43`
- Modify: `contrib/hooks/use-task-comments.ts:42-46`
- Modify: `contrib/hooks/use-courses.ts:40-43`
- Modify: `contrib/hooks/use-group.ts:47`

- [ ] **Step 1: Fix `use-tasks.ts` — replace wildcard with explicit columns**

In `contrib/hooks/use-tasks.ts`, add the import and change the select:

Add at top (after existing imports):
```ts
import { PROFILE_SELECT } from '@/lib/columns';
```

Replace line 45:
```ts
// OLD:
.select('*, assignee:profiles!tasks_assignee_id_fkey(*)')
// NEW:
.select(`id, group_id, title, description, assignee_id, status, due_date, completed_at, contribution_type, created_at, assignee:profiles!tasks_assignee_id_fkey(${PROFILE_SELECT})`)
```

- [ ] **Step 2: Fix `use-evidence.ts` — replace wildcard with explicit columns**

In `contrib/hooks/use-evidence.ts`, add the import and change the select:

Add at top (after existing imports):
```ts
import { PROFILE_SELECT } from '@/lib/columns';
```

Replace line 42:
```ts
// OLD:
.select('*, uploader:profiles!evidence_uploaded_by_fkey(*)')
// NEW:
.select(`id, task_id, uploaded_by, type, content, version_number, created_at, uploader:profiles!evidence_uploaded_by_fkey(${PROFILE_SELECT})`)
```

- [ ] **Step 3: Fix `use-task-comments.ts` — replace wildcard with explicit columns**

In `contrib/hooks/use-task-comments.ts`, add the import and change the select:

Add at top (after existing imports):
```ts
import { PROFILE_SELECT } from '@/lib/columns';
```

Replace line 45:
```ts
// OLD:
.select('*, author:profiles!task_comments_author_id_fkey(*)')
// NEW:
.select(`id, task_id, author_id, content, created_at, author:profiles!task_comments_author_id_fkey(${PROFILE_SELECT})`)
```

- [ ] **Step 4: Fix `use-courses.ts` — remove `invite_token` from select**

In `contrib/hooks/use-courses.ts`, change line 42:

```ts
// OLD:
.select('id, name, subject, teacher_id, invite_token, created_at')
// NEW:
.select('id, name, subject, teacher_id, created_at')
```

Note: `use-course.ts` (singular) still needs `invite_token` because the teacher course detail page uses `course.invite_token` at line 155 and `group.invite_token` at line 514. Removing it from `use-course.ts` requires a fetch-on-demand pattern — deferred per spec.

- [ ] **Step 5: Fix `use-group.ts` — add `invite_token` to select**

In `contrib/hooks/use-group.ts`, change line 47:

```ts
// OLD:
supabase.from('groups').select('id, name, subject, due_date, lead_id, course_id, created_at').eq('id', id).single(),
// NEW:
supabase.from('groups').select('id, name, subject, due_date, lead_id, course_id, invite_token, created_at').eq('id', id).single(),
```

This fixes the broken "Copy invite link" button which was generating `/join/undefined`.

- [ ] **Step 6: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/hooks/use-tasks.ts contrib/hooks/use-evidence.ts contrib/hooks/use-task-comments.ts contrib/hooks/use-courses.ts contrib/hooks/use-group.ts && git commit -m "fix: replace wildcard selects with explicit columns, fix broken invite link copy"
```

---

### Task 3: Add security headers (Fix 4)

**Files:**
- Modify: `contrib/next.config.ts:19-28`

- [ ] **Step 1: Add security headers to `next.config.ts`**

In `contrib/next.config.ts`, replace the `headers` array content (lines 22-25):

```ts
// OLD:
headers: [
  { key: "Content-Security-Policy", value: csp },
],

// NEW:
headers: [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
],
```

- [ ] **Step 2: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/next.config.ts && git commit -m "fix: add standard security headers (X-Frame-Options, HSTS, nosniff, Referrer-Policy)"
```

---

### Task 4: Add onboard validation schema (Fix 6 prerequisite)

**Files:**
- Modify: `contrib/lib/validation.ts`

- [ ] **Step 1: Add `onboardSchema` to `lib/validation.ts`**

Add after the `createCourseSchema` block (after line 84):

```ts
// ── Onboarding ─────────────────────────────────────────────────────────────

export const onboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or less.'),
  university: z.string().trim().max(200, 'University must be 200 characters or less.').optional().default(''),
  faculty: z.string().trim().max(200, 'Faculty must be 200 characters or less.').optional().default(''),
  year_of_study: z.enum(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5 or above']).nullable().optional(),
  role: z.enum(['student', 'teacher']),
});
```

- [ ] **Step 2: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/lib/validation.ts && git commit -m "feat: add onboard validation schema for server-side profile creation"
```

---

### Task 5: Create course join API route (Fix 5)

**Files:**
- Create: `contrib/pages/api/courses/[id]/join.ts`
- Modify: `contrib/pages/join/course/[token].tsx:35-56`

- [ ] **Step 1: Create `pages/api/courses/[id]/join.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`course-join:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const courseId = req.query.id;
  if (typeof courseId !== 'string') return res.status(400).json({ error: 'Invalid course ID.' });

  // Check caller's role — only students can join courses
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return res.status(403).json({ error: 'Profile not found. Complete onboarding first.' });
  if (profile.role !== 'student') return res.status(403).json({ error: 'Only students can join courses.' });

  // Verify the course exists
  const { data: course } = await adminClient
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .single();

  if (!course) return res.status(404).json({ error: 'Course not found.' });

  // Check if already a member
  const { data: existing } = await adminClient
    .from('course_members')
    .select('id')
    .eq('course_id', courseId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) return res.status(200).json({ already: true });

  // Insert membership
  const { error: insertError } = await adminClient
    .from('course_members')
    .insert({ course_id: courseId, profile_id: user.id });

  if (insertError) {
    // Handle duplicate key race condition
    if (insertError.code === '23505') return res.status(200).json({ already: true });
    Sentry.captureMessage(`[course-join] insert error: ${insertError.message}`, {
      level: 'error',
      tags: { route: 'course-join' },
    });
    return res.status(500).json({ error: 'Failed to join course.' });
  }

  return res.status(200).json({ joined: true });
}
```

- [ ] **Step 2: Update `pages/join/course/[token].tsx` to use the API route**

Replace the `handleJoin` function (lines 35-57):

```ts
  async function handleJoin() {
    if (!course || !user) return;
    setStatus('joining');

    try {
      const resp = await fetch(`/api/courses/${course.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMsg(data.error || 'Failed to join course.');
        setStatus('error');
        return;
      }

      if (data.already) {
        setStatus('already');
        return;
      }

      setStatus('joined');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }
```

Also remove the unused `supabase` import from line 6 if no other code in the file uses it. Check first — the `useEffect` at line 22 uses `supabase.from('course_members').select(...)` to check existing membership. That can stay client-side (it's a read, not a write). Keep the import.

- [ ] **Step 3: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/pages/api/courses/[id]/join.ts contrib/pages/join/course/[token].tsx && git commit -m "fix: move course join to API route with rate limiting and student-only role check"
```

---

### Task 6: Create onboarding API route (Fix 6)

**Files:**
- Create: `contrib/pages/api/profile/onboard.ts`
- Modify: `contrib/pages/onboarding.tsx:37-56`

- [ ] **Step 1: Create `pages/api/profile/onboard.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validate, onboardSchema } from '@/lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`onboard:${ip}`, 5, 60_000))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { data: input, error: validationError } = validate(onboardSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  // Check if profile already exists — prevent re-onboarding to change role
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfile) return res.status(409).json({ error: 'Profile already exists.' });

  // Get avatar URL from auth metadata
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(user.id);
  const avatarUrl = authUser?.user_metadata?.avatar_url ?? null;

  const { error: insertError } = await adminClient
    .from('profiles')
    .insert({
      id: user.id,
      name: input.name,
      university: input.university,
      faculty: input.faculty,
      year_of_study: input.year_of_study ?? null,
      avatar_url: avatarUrl,
      role: input.role,
    });

  if (insertError) {
    // Handle race condition (profile created between check and insert)
    if (insertError.code === '23505') return res.status(409).json({ error: 'Profile already exists.' });
    Sentry.captureMessage(`[profile/onboard] insert error: ${insertError.message}`, {
      level: 'error',
      tags: { route: 'profile-onboard' },
    });
    return res.status(500).json({ error: 'Failed to create profile.' });
  }

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Update `pages/onboarding.tsx` to use the API route**

Replace the `saveProfile` function (lines 37-56):

```ts
  async function saveProfile(nameVal: string, universityVal: string, facultyVal: string, yearVal: string) {
    if (!user) return false;
    setLoading(true);
    try {
      const resp = await fetch('/api/profile/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal.trim() || 'User',
          university: universityVal.trim(),
          faculty: facultyVal.trim(),
          year_of_study: yearVal || null,
          role,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Failed to create profile.');
        return false;
      }
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    }
  }
```

Also remove the `supabase` import from line 5 if it's no longer used elsewhere in the file. Check: `supabase.auth.getSession()` is used in the `useEffect` at line 26. Keep the import.

- [ ] **Step 3: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/pages/api/profile/onboard.ts contrib/pages/onboarding.tsx && git commit -m "fix: move onboarding to API route to prevent client-side role escalation"
```

---

### Task 7: Add archived group guard to transfer-lead (Fix 7)

**Files:**
- Modify: `contrib/pages/api/groups/[id]/transfer-lead.ts:39-45`

- [ ] **Step 1: Add `archived_at` check to transfer-lead**

In `contrib/pages/api/groups/[id]/transfer-lead.ts`, change the select and add the guard:

Replace lines 39-45:
```ts
  // OLD:
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });
```

With:
```ts
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id, archived_at')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (group.archived_at) return res.status(410).json({ error: 'This group has been archived.' });
```

- [ ] **Step 2: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/pages/api/groups/[id]/transfer-lead.ts && git commit -m "fix: block lead transfer on archived groups"
```

---

### Task 8: Add per-email rate limit on forgot-password + hardcode redirectTo (Fix 8 + Fix 14)

**Files:**
- Modify: `contrib/pages/api/auth/forgot-password.ts`

- [ ] **Step 1: Add per-email rate limit and hardcode redirectTo**

In `contrib/pages/api/auth/forgot-password.ts`:

Add after line 18 (after the IP rate limit check, after `parsed` validation at line 20-23):

```ts
  // Per-email rate limit: 3 requests per hour
  const emailKey = `forgot-password:email:${parsed.data.email.toLowerCase()}`;
  if (!(await rateLimit(emailKey, 3, 3600_000))) {
    // Still return 200 to prevent email enumeration
    return res.status(200).json({ ok: true });
  }
```

Note: This must go AFTER `parsed` is validated (line 20-23), since we need `parsed.data.email`. Insert it between the `safeParse` check and the `try` block.

Also replace lines 26-31:
```ts
  // OLD:
  try {
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${origin}/reset-password` },
    );

  // NEW:
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${appUrl}/reset-password` },
    );
```

The complete file after changes:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit: 10 requests per IP per minute
  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`forgot-password:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  // Per-email rate limit: 3 requests per hour
  const emailKey = `forgot-password:email:${parsed.data.email.toLowerCase()}`;
  if (!(await rateLimit(emailKey, 3, 3600_000))) {
    // Still return 200 to prevent email enumeration
    return res.status(200).json({ ok: true });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${appUrl}/reset-password` },
    );

    if (resetError) {
      // Log but don't expose — prevent email enumeration
      Sentry.captureMessage(`[forgot-password] ${resetError.message}`, {
        level: 'warning',
        tags: { route: 'forgot-password' },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'forgot-password' } });
  }

  // Always return 200 to prevent email enumeration
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/pages/api/auth/forgot-password.ts && git commit -m "fix: add per-email rate limit and hardcode redirectTo on forgot-password"
```

---

### Task 9: Add maxDuration for cron + parallelize digest queries (Fix 9 + Fix 11)

**Files:**
- Modify: `contrib/vercel.json`
- Modify: `contrib/pages/api/cron/daily.ts:49-222`

- [ ] **Step 1: Add `functions` config to `vercel.json`**

Replace entire `contrib/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "30 0 * * *"
    }
  ],
  "functions": {
    "pages/api/cron/daily.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 2: Parallelize per-course queries in `sendTeacherDigest`**

In `contrib/pages/api/cron/daily.ts`, the inner `for (const course of courses)` loop (lines 49-222) runs sequentially. Replace the entire `sendTeacherDigest` function with a version that parallelizes per-course work within each teacher:

Replace lines 7-226 (the entire `sendTeacherDigest` function):

```ts
async function sendTeacherDigest(): Promise<number> {
  let digestsSent = 0;

  // 1. Fetch all teachers
  const { data: teachers, error: teachersError } = await adminClient
    .from('profiles')
    .select('id, name')
    .eq('role', 'teacher');

  if (teachersError) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest teachers query error: ${teachersError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily' },
    });
    return 0;
  }

  if (!teachers?.length) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const teacher of teachers) {
    // 2. Fetch courses for this teacher
    const { data: courses, error: coursesError } = await adminClient
      .from('courses')
      .select('id, name')
      .eq('teacher_id', teacher.id);

    if (coursesError) {
      Sentry.captureMessage(`[cron/daily] sendTeacherDigest courses query error: ${coursesError.message}`, {
        level: 'error',
        tags: { route: 'cron/daily', teacher_id: teacher.id },
      });
      continue;
    }

    if (!courses?.length) continue;

    // Process all courses for this teacher in parallel
    const courseResults = await Promise.all(
      courses.map(async (course) => {
        try {
          return await processTeacherCourse(teacher, course, todayStr, sevenDaysAgo);
        } catch (err) {
          Sentry.captureException(err, {
            tags: { route: 'cron/daily', teacher_id: teacher.id, course_id: course.id },
          });
          return 0;
        }
      })
    );

    digestsSent += courseResults.reduce((sum, n) => sum + n, 0);
  }

  return digestsSent;
}

async function processTeacherCourse(
  teacher: { id: string; name: string },
  course: { id: string; name: string },
  todayStr: string,
  sevenDaysAgo: string,
): Promise<number> {
  // 3. Fetch groups for this course
  const { data: groups, error: groupsError } = await adminClient
    .from('groups')
    .select('id, name, due_date')
    .eq('course_id', course.id)
    .is('archived_at', null);

  if (groupsError) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest groups query error: ${groupsError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily', course_id: course.id },
    });
    return 0;
  }

  const groupList = groups ?? [];
  const groupIds = groupList.map((g) => g.id);

  if (groupIds.length === 0) {
    // Still send digest with zero groups
    await sendDigestMessage(teacher, course, { groupCount: 0, totalStudents: 0, completionPct: 0, overdueCount: 0, blockerCount: 0, inactiveCount: 0 });
    return 1;
  }

  // 4. Run all stat queries in parallel
  const [memberResult, tasksResult, blockerResult, activityResult] = await Promise.all([
    adminClient
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .in('group_id', groupIds),
    adminClient
      .from('tasks')
      .select('id, status')
      .in('group_id', groupIds)
      .is('deleted_at', null),
    adminClient
      .from('blocker_declarations')
      .select('id', { count: 'exact', head: true })
      .in('group_id', groupIds)
      .gte('created_at', sevenDaysAgo),
    adminClient
      .from('activity_log')
      .select('group_id')
      .in('group_id', groupIds)
      .gte('created_at', sevenDaysAgo),
  ]);

  const totalStudents = memberResult.error ? 0 : (memberResult.count ?? 0);
  if (memberResult.error) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest group_members count error: ${memberResult.error.message}`, { level: 'error', tags: { route: 'cron/daily', course_id: course.id } });
  }

  let completionPct = 0;
  if (!tasksResult.error && tasksResult.data?.length) {
    const doneTasks = tasksResult.data.filter((t) => t.status === 'done').length;
    completionPct = Math.round((doneTasks / tasksResult.data.length) * 100);
  }
  if (tasksResult.error) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest tasks query error: ${tasksResult.error.message}`, { level: 'error', tags: { route: 'cron/daily', course_id: course.id } });
  }

  // Overdue check — needs incomplete tasks for overdue groups specifically
  let overdueCount = 0;
  const overdueGroupIds = groupList
    .filter((g) => g.due_date && g.due_date < todayStr)
    .map((g) => g.id);
  if (overdueGroupIds.length > 0) {
    const { data: incompleteTasks, error: incompleteError } = await adminClient
      .from('tasks')
      .select('group_id')
      .in('group_id', overdueGroupIds)
      .neq('status', 'done')
      .is('deleted_at', null);
    if (incompleteError) {
      Sentry.captureMessage(`[cron/daily] sendTeacherDigest overdue tasks query error: ${incompleteError.message}`, { level: 'error', tags: { route: 'cron/daily', course_id: course.id } });
    } else {
      const groupsWithIncomplete = new Set((incompleteTasks ?? []).map((t) => t.group_id));
      overdueCount = groupsWithIncomplete.size;
    }
  }

  const blockerCount = blockerResult.error ? 0 : (blockerResult.count ?? 0);
  if (blockerResult.error) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest blockers query error: ${blockerResult.error.message}`, { level: 'error', tags: { route: 'cron/daily', course_id: course.id } });
  }

  let inactiveCount = 0;
  if (!activityResult.error) {
    const activeGroupIds = new Set((activityResult.data ?? []).map((a) => a.group_id));
    inactiveCount = groupIds.filter((id) => !activeGroupIds.has(id)).length;
  }
  if (activityResult.error) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest activity_log query error: ${activityResult.error.message}`, { level: 'error', tags: { route: 'cron/daily', course_id: course.id } });
  }

  await sendDigestMessage(teacher, course, {
    groupCount: groupList.length,
    totalStudents,
    completionPct,
    overdueCount,
    blockerCount,
    inactiveCount,
  });

  return 1;
}

async function sendDigestMessage(
  teacher: { id: string; name: string },
  course: { id: string; name: string },
  stats: { groupCount: number; totalStudents: number; completionPct: number; overdueCount: number; blockerCount: number; inactiveCount: number },
) {
  const lines: string[] = [
    `Weekly Digest -- ${course.name}`,
    '',
    `Groups: ${stats.groupCount} (${stats.totalStudents} students)`,
    `Completion: ${stats.completionPct}%`,
  ];
  if (stats.overdueCount > 0) lines.push(`Overdue: ${stats.overdueCount} groups`);
  if (stats.blockerCount > 0) lines.push(`Blockers: ${stats.blockerCount} unresolved`);
  if (stats.inactiveCount > 0) lines.push(`Inactive: ${stats.inactiveCount} groups (7+ days)`);
  lines.push('');
  lines.push('View details at joincontrib.com/teacher');

  const message = lines.join('\n');

  // Send via Telegram if teacher has a verified subscription with weekly digest enabled
  const { data: subscription, error: subError } = await adminClient
    .from('telegram_subscriptions')
    .select('chat_id')
    .eq('profile_id', teacher.id)
    .eq('verified', true)
    .eq('notify_weekly_digest', true)
    .maybeSingle();

  if (subError) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest subscription query error: ${subError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily', teacher_id: teacher.id },
    });
  } else if (subscription?.chat_id) {
    await sendTelegramMessage(String(subscription.chat_id), message);
  }

  // Insert in-app notification
  const { error: notifError } = await adminClient.from('notifications').insert({
    recipient_id: teacher.id,
    group_id: null,
    type: 'weekly_digest',
    title: `Weekly Digest -- ${course.name}`,
    meta: { courseId: course.id, courseName: course.name },
  });

  if (notifError) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest notification insert error: ${notifError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily', teacher_id: teacher.id, course_id: course.id },
    });
  }
}
```

- [ ] **Step 3: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/vercel.json contrib/pages/api/cron/daily.ts && git commit -m "fix: add maxDuration for cron, parallelize per-course digest queries"
```

---

### Task 10: Harden course delete atomicity (Fix 10)

**Files:**
- Modify: `contrib/pages/api/courses/[id]/delete.ts:75-91`

- [ ] **Step 1: Fail fast on batch delete errors**

In `contrib/pages/api/courses/[id]/delete.ts`, replace lines 85-91 (the `Promise.all` result handling):

```ts
    // OLD:
    const results = await Promise.all(deleteOps);
    results.forEach((result, i) => {
      if (result.error) {
        const tables = ['group_members', 'activity_log', 'notifications', 'blocker_declarations', 'evaluations', 'evaluation_sessions', 'report_shares'];
        Sentry.captureMessage(`[course-delete] ${tables[i]} error: ${result.error.message}`, { level: 'error', tags: { route: 'course-delete' } });
      }
    });

    // NEW:
    const tables = ['group_members', 'activity_log', 'notifications', 'blocker_declarations', 'evaluations', 'evaluation_sessions', 'report_shares'];
    const results = await Promise.all(deleteOps);
    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        Sentry.captureMessage(`[course-delete] ${tables[i]} error: ${results[i].error!.message}`, {
          level: 'error',
          tags: { route: 'course-delete' },
          extra: { courseId, groupIds },
        });
        return res.status(500).json({ error: `Failed to delete course data (${tables[i]}).` });
      }
    }
```

- [ ] **Step 2: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/pages/api/courses/[id]/delete.ts && git commit -m "fix: fail fast on cascade delete errors to prevent orphaned data"
```

---

### Task 11: Add `group_created` activity log entry (Fix 12)

**Files:**
- Modify: `contrib/pages/api/groups/create.ts:128-134`
- Modify: `contrib/types/index.ts:77-99`

- [ ] **Step 1: Add `group_created` to `ActivityAction` type**

In `contrib/types/index.ts`, add `'group_created'` to the `ActivityAction` union (after `'comment_added'` at line 99):

```ts
// OLD (line 99):
  | 'comment_added';

// NEW:
  | 'comment_added'
  | 'group_created';
```

- [ ] **Step 2: Add `lead_transferred` and `member_added` to `NotificationType` (Fix 15)**

In `contrib/types/index.ts`, update line 194:

```ts
// OLD:
export type NotificationType = 'task_assigned' | 'task_reassigned' | 'evaluation_opened' | 'member_joined' | 'evidence_added' | 'blocker_declared' | 'deadline_approaching' | 'weekly_digest' | 'task_comment';

// NEW:
export type NotificationType = 'task_assigned' | 'task_reassigned' | 'evaluation_opened' | 'member_joined' | 'member_added' | 'lead_transferred' | 'evidence_added' | 'blocker_declared' | 'deadline_approaching' | 'weekly_digest' | 'task_comment';
```

- [ ] **Step 3: Change activity log in `groups/create.ts`**

In `contrib/pages/api/groups/create.ts`, replace line 130:

```ts
// OLD:
  const { error: activityError } = await adminClient
    .from('activity_log')
    .insert({ group_id: group.id, actor_id: user.id, action: 'member_joined', meta: {} });

// NEW:
  const { error: activityError } = await adminClient
    .from('activity_log')
    .insert({ group_id: group.id, actor_id: user.id, action: 'group_created', meta: { groupName: group.name } });
```

- [ ] **Step 4: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/types/index.ts contrib/pages/api/groups/create.ts && git commit -m "fix: log group_created on group creation, add missing notification types"
```

---

### Task 12: Sentry DSN validation + final build check (Fix 13)

**Files:**
- Modify: `contrib/sentry.client.config.ts`
- Modify: `contrib/sentry.server.config.ts`

- [ ] **Step 1: Add DSN validation to `sentry.client.config.ts`**

In `contrib/sentry.client.config.ts`, add before `Sentry.init`:

```ts
import * as Sentry from '@sentry/nextjs';

if (!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production') {
  console.error('[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set — client errors will not be captured');
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
});
```

- [ ] **Step 2: Add DSN validation to `sentry.server.config.ts`**

In `contrib/sentry.server.config.ts`, add before `Sentry.init`:

```ts
import * as Sentry from '@sentry/nextjs';

if (!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production') {
  console.error('[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set — server errors will not be captured');
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  debug: false,
});
```

- [ ] **Step 3: Type check**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Full build verification**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Run tests**

Run: `cd "C:/Users/USer/Desktop/Dev Projects/Contrib/contrib" && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/USer/Desktop/Dev Projects/Contrib" && git add contrib/sentry.client.config.ts contrib/sentry.server.config.ts && git commit -m "fix: warn when Sentry DSN is missing in production"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Copy invite link on the group page generates a valid URL (not `/join/undefined`)
- [ ] Teacher course page still shows course invite link correctly
- [ ] Network tab for group page no longer shows `invite_token` in profile joins
- [ ] Security headers are present (check response headers in browser DevTools)
