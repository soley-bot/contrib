import { useEffect } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

interface UseCoursesResult {
  courses: Course[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchCourses(teacherId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, subject, teacher_id, invite_token, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) {
    Sentry.captureMessage(`Failed to load courses: ${error.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  return (data as Course[]) ?? [];
}

export function useCourses(teacherId: string | undefined): UseCoursesResult {
  const key = teacherId ? ['courses', teacherId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchCourses(id));

  useEffect(() => {
    if (!teacherId) return;
    const channel = supabase
      .channel(`courses:${teacherId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'courses',
        filter: `teacher_id=eq.${teacherId}`,
      }, () => { void mutate(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, mutate]);

  return {
    courses: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
