import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

interface UseCourseMembershipsResult {
  courses: Course[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchCourseMemberships(userId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from('course_members')
    .select('course:courses(id, name, subject, teacher_id, invite_token, created_at)')
    .eq('profile_id', userId);
  if (error) {
    Sentry.captureMessage(`Failed to load course memberships: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data ?? []).map((row: { course: unknown }) => row.course as Course).filter(Boolean);
}

export function useCourseMemberships(userId: string | undefined): UseCourseMembershipsResult {
  const key = userId ? ['course-memberships', userId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchCourseMemberships(id));

  return {
    courses: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
