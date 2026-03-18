import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { generateInviteToken } from '@/lib/invite';
import type { Course } from '@/types';

interface CreateCourseInput {
  name: string;
  subject: string;
  teacherId: string;
}

interface UseCreateCourseResult {
  createCourse: (input: CreateCourseInput) => Promise<Course | null>;
  creating: boolean;
  error: string;
}

export function useCreateCourse(): UseCreateCourseResult {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function createCourse({ name, subject, teacherId }: CreateCourseInput): Promise<Course | null> {
    setCreating(true);
    setError('');
    const token = generateInviteToken();
    const { data, error: dbError } = await supabase
      .from('courses')
      .insert({ name: name.trim(), subject: subject.trim(), teacher_id: teacherId, invite_token: token })
      .select()
      .single();
    setCreating(false);
    if (dbError || !data) { setError(dbError?.message ?? 'Failed to create course.'); return null; }
    return data as Course;
  }

  return { createCourse, creating, error };
}
