import { useState } from 'react';
import type { Course } from '@/types';

interface CreateCourseInput {
  name: string;
  subject: string;
}

export type CreateCourseResult =
  | { course: Course; error: null }
  | { course: null; error: string };

interface UseCreateCourseResult {
  createCourse: (input: CreateCourseInput) => Promise<CreateCourseResult>;
  creating: boolean;
}

export function useCreateCourse(): UseCreateCourseResult {
  const [creating, setCreating] = useState(false);

  async function createCourse({ name, subject }: CreateCourseInput): Promise<CreateCourseResult> {
    setCreating(true);
    try {
      const resp = await fetch('/api/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), subject: subject.trim() }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body.course) {
        return { course: null, error: body.error ?? 'Failed to create course.' };
      }
      return { course: body.course as Course, error: null };
    } catch (err) {
      return { course: null, error: err instanceof Error ? err.message : 'Failed to create course.' };
    } finally {
      setCreating(false);
    }
  }

  return { createCourse, creating };
}
