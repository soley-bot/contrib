import { z } from 'zod';

// ── Signup ──────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or less.'),
  university: z.string().trim().min(1, 'University is required.').max(200, 'University must be 200 characters or less.'),
  role: z.enum(['student', 'teacher']).optional().default('student'),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ── Join lookup ─────────────────────────────────────────────────────────────

export const joinLookupSchema = z.object({
  token: z.string().min(1, 'Token is required.').max(50, 'Invalid token.'),
});

// ── Group creation ──────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required.').max(200, 'Group name must be 200 characters or less.'),
  subject: z.string().trim().min(1, 'Subject is required.').max(200, 'Subject must be 200 characters or less.'),
  due_date: z.string().nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
});

// ── Group creation API (server-side) ───────────────────────────────────────

export const createGroupApiSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required.').max(200, 'Group name must be 200 characters or less.'),
  subject: z.string().trim().min(1, 'Subject is required.').max(200, 'Subject must be 200 characters or less.'),
  dueDate: z.string().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().optional(),
});

// ── Group edit (name / subject / due date) ────────────────────────────────

export const editGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required.').max(200, 'Group name must be 200 characters or less.'),
  subject: z.string().trim().min(1, 'Subject is required.').max(200, 'Subject must be 200 characters or less.'),
  dueDate: z.string().nullable().optional(),
});

// ── Group member management ────────────────────────────────────────────────

export const addMemberSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID.'),
});

export const removeMemberSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID.'),
});

// ── Task creation / editing ─────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(300, 'Task title must be 300 characters or less.'),
  description: z.string().max(2000, 'Description must be 2000 characters or less.').nullable().optional(),
  assignee_id: z.string().uuid('Invalid assignee.'),
  due_date: z.string().nullable().optional(),
  group_id: z.string().uuid('Invalid group.'),
});

// ── Evidence ────────────────────────────────────────────────────────────────

export const createEvidenceSchema = z.object({
  task_id: z.string().uuid('Invalid task.'),
  type: z.enum(['file', 'link', 'note']),
  content: z.string().trim().min(1, 'Content is required.').max(2000, 'Content must be 2000 characters or less.'),
});

// ── Evidence API (server-side, discriminated by type) ──────────────────────
// Used by POST /api/evidence/create. The `file` branch carries no `content`
// in the JSON part — the actual file is a multipart field.

export const createEvidenceApiSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    task_id: z.string().uuid('Invalid task.'),
  }),
  z.object({
    type: z.literal('link'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().url('Must be a valid URL.').max(2000, 'URL is too long.'),
  }),
  z.object({
    type: z.literal('note'),
    task_id: z.string().uuid('Invalid task.'),
    content: z.string().trim().min(1, 'Content is required.').max(2000, 'Note is too long (max 2000).'),
  }),
]);

// ── Evaluation ──────────────────────────────────────────────────────────────

export const evaluationEntrySchema = z.object({
  group_id: z.string().uuid(),
  evaluator_id: z.string().uuid(),
  evaluatee_id: z.string().uuid(),
  contribution_score: z.number().int().min(1).max(5),
  collaboration_score: z.number().int().min(1).max(5),
  comment: z.string().max(1000, 'Comment must be 1000 characters or less.').nullable().optional(),
});

// ── Course creation ─────────────────────────────────────────────────────────

export const createCourseSchema = z.object({
  name: z.string().trim().min(1, 'Course name is required.').max(200, 'Course name must be 200 characters or less.'),
  subject: z.string().trim().min(1, 'Subject code is required.').max(100, 'Subject code must be 100 characters or less.'),
});

// ── Profile role change ─────────────────────────────────────────────────────

export const roleChangeSchema = z.object({
  role: z.enum(['student', 'teacher']),
});

// ── Onboarding ─────────────────────────────────────────────────────────────

export const onboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or less.'),
  university: z.string().trim().max(200, 'University must be 200 characters or less.').optional().default(''),
  faculty: z.string().trim().max(200, 'Faculty must be 200 characters or less.').optional().default(''),
  year_of_study: z.enum(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5 or above']).nullable().optional(),
  role: z.enum(['student', 'teacher']).optional(),
});

// ── Blocker declaration ─────────────────────────────────────────

export const createBlockerSchema = z.object({
  reason: z.string().trim().min(3, 'Please describe your situation briefly.').max(500, 'Reason must be 500 characters or less.'),
});

// ── Task comments ───────────────────────────────────────────────────────────

export const taskCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty.').max(2000, 'Comment is too long (max 2000 characters).'),
});

// ── Report sharing ─────────────────────────────────────────────────────────

export const reportLookupSchema = z.object({
  token: z.string().min(1, 'Token is required.').max(50, 'Invalid token.'),
});

export const reportShareSchema = z.object({
  group_id: z.string().uuid('Invalid group.'),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate input and return either the parsed data or a formatted error string.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, error: null };
  const message = result.error.issues.map((i) => i.message).join(' ');
  return { data: null, error: message };
}
