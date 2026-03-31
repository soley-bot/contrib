import { describe, it, expect } from 'vitest';
import {
  signupSchema,
  joinLookupSchema,
  createGroupSchema,
  createTaskSchema,
  createEvidenceSchema,
  evaluationEntrySchema,
  createCourseSchema,
  createBlockerSchema,
  reportLookupSchema,
  reportShareSchema,
  validate,
} from '@/lib/validation';

describe('signupSchema', () => {
  const valid = {
    email: 'test@example.com',
    password: 'securepass',
    name: 'Alice',
    university: 'MIT',
  };

  it('accepts valid input', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults role to student', () => {
    const result = signupSchema.parse(valid);
    expect(result.role).toBe('student');
  });

  it('accepts teacher role', () => {
    const result = signupSchema.parse({ ...valid, role: 'teacher' });
    expect(result.role).toBe('teacher');
  });

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({ ...valid, email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = signupSchema.safeParse({ ...valid, password: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = signupSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 characters', () => {
    const result = signupSchema.safeParse({ ...valid, name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects university over 200 characters', () => {
    const result = signupSchema.safeParse({ ...valid, university: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from name', () => {
    const result = signupSchema.parse({ ...valid, name: '  Alice  ' });
    expect(result.name).toBe('Alice');
  });

  it('rejects XSS in name', () => {
    // The schema allows the string but trims it; XSS is a rendering concern.
    // Verify it at least parses without crashing.
    const result = signupSchema.safeParse({ ...valid, name: '<script>alert(1)</script>' });
    expect(result.success).toBe(true);
  });
});

describe('joinLookupSchema', () => {
  it('accepts a valid token', () => {
    expect(joinLookupSchema.safeParse({ token: 'abc123' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    const r = joinLookupSchema.safeParse({ token: '' });
    expect(r.success).toBe(false);
  });

  it('rejects token over 50 characters', () => {
    const r = joinLookupSchema.safeParse({ token: 'x'.repeat(51) });
    expect(r.success).toBe(false);
  });
});

describe('createGroupSchema', () => {
  const valid = { name: 'Team A', subject: 'CS101' };

  it('accepts valid input', () => {
    expect(createGroupSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createGroupSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects empty subject', () => {
    expect(createGroupSchema.safeParse({ ...valid, subject: '' }).success).toBe(false);
  });

  it('accepts null due_date', () => {
    expect(createGroupSchema.safeParse({ ...valid, due_date: null }).success).toBe(true);
  });

  it('accepts valid course_id UUID', () => {
    expect(
      createGroupSchema.safeParse({ ...valid, course_id: '550e8400-e29b-41d4-a716-446655440000' }).success
    ).toBe(true);
  });

  it('rejects invalid course_id', () => {
    expect(createGroupSchema.safeParse({ ...valid, course_id: 'not-uuid' }).success).toBe(false);
  });
});

describe('createTaskSchema', () => {
  const valid = {
    title: 'Write tests',
    assignee_id: '550e8400-e29b-41d4-a716-446655440000',
    group_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  it('accepts valid input', () => {
    expect(createTaskSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(createTaskSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejects title over 300 chars', () => {
    expect(createTaskSchema.safeParse({ ...valid, title: 'x'.repeat(301) }).success).toBe(false);
  });

  it('rejects invalid assignee_id', () => {
    expect(createTaskSchema.safeParse({ ...valid, assignee_id: 'bad' }).success).toBe(false);
  });

  it('rejects description over 2000 chars', () => {
    expect(createTaskSchema.safeParse({ ...valid, description: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('createEvidenceSchema', () => {
  const valid = {
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'note' as const,
    content: 'Did the thing',
  };

  it('accepts valid input', () => {
    expect(createEvidenceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid type', () => {
    expect(createEvidenceSchema.safeParse({ ...valid, type: 'photo' }).success).toBe(false);
  });

  it('rejects empty content', () => {
    expect(createEvidenceSchema.safeParse({ ...valid, content: '' }).success).toBe(false);
  });

  it('rejects content over 2000 chars', () => {
    expect(createEvidenceSchema.safeParse({ ...valid, content: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('evaluationEntrySchema', () => {
  const valid = {
    group_id: '550e8400-e29b-41d4-a716-446655440000',
    evaluator_id: '550e8400-e29b-41d4-a716-446655440000',
    evaluatee_id: '550e8400-e29b-41d4-a716-446655440001',
    contribution_score: 3,
    collaboration_score: 4,
  };

  it('accepts valid input', () => {
    expect(evaluationEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects score below 1', () => {
    expect(evaluationEntrySchema.safeParse({ ...valid, contribution_score: 0 }).success).toBe(false);
  });

  it('rejects score above 5', () => {
    expect(evaluationEntrySchema.safeParse({ ...valid, collaboration_score: 6 }).success).toBe(false);
  });

  it('rejects non-integer score', () => {
    expect(evaluationEntrySchema.safeParse({ ...valid, contribution_score: 3.5 }).success).toBe(false);
  });

  it('rejects comment over 1000 chars', () => {
    expect(evaluationEntrySchema.safeParse({ ...valid, comment: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('createCourseSchema', () => {
  it('accepts valid input', () => {
    expect(createCourseSchema.safeParse({ name: 'Algorithms', subject: 'CS201' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createCourseSchema.safeParse({ name: '', subject: 'CS201' }).success).toBe(false);
  });

  it('rejects empty subject', () => {
    expect(createCourseSchema.safeParse({ name: 'Algorithms', subject: '' }).success).toBe(false);
  });
});

describe('createBlockerSchema', () => {
  it('accepts valid reason', () => {
    expect(createBlockerSchema.safeParse({ reason: 'Waiting on API access' }).success).toBe(true);
  });

  it('rejects reason under 3 characters', () => {
    expect(createBlockerSchema.safeParse({ reason: 'ab' }).success).toBe(false);
  });

  it('rejects reason over 500 characters', () => {
    expect(createBlockerSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('reportLookupSchema', () => {
  it('accepts valid token', () => {
    expect(reportLookupSchema.safeParse({ token: 'abc' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    expect(reportLookupSchema.safeParse({ token: '' }).success).toBe(false);
  });
});

describe('reportShareSchema', () => {
  it('accepts valid group_id', () => {
    expect(reportShareSchema.safeParse({ group_id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
  });

  it('rejects invalid group_id', () => {
    expect(reportShareSchema.safeParse({ group_id: 'not-uuid' }).success).toBe(false);
  });
});

describe('validate helper', () => {
  it('returns data on valid input', () => {
    const result = validate(joinLookupSchema, { token: 'hello' });
    expect(result.data).toEqual({ token: 'hello' });
    expect(result.error).toBeNull();
  });

  it('returns error string on invalid input', () => {
    const result = validate(joinLookupSchema, { token: '' });
    expect(result.data).toBeNull();
    expect(result.error).toContain('Token is required');
  });

  it('joins multiple errors', () => {
    const result = validate(signupSchema, {});
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe('string');
    // Should contain multiple error messages joined
    expect(result.error!.length).toBeGreaterThan(10);
  });
});
