import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

interface UseCoursesResult {
  courses: Course[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCourses(teacherId: string | undefined): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!teacherId) { setLoading(false); return; }
    setLoading(true);
    fetchCourses(teacherId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`courses:${teacherId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'courses',
        filter: `teacher_id=eq.${teacherId}`,
      }, () => {
        fetchCourses(teacherId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, tick]);

  async function fetchCourses(id: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, subject, teacher_id, created_at')
      .eq('teacher_id', id)
      .order('created_at', { ascending: false });
    if (error) {
      Sentry.captureMessage(`Failed to load courses: ${error.message}`, { level: 'error' });
      setError('Failed to load data.');
      return;
    }
    setError(null);
    setCourses((data as Course[]) ?? []);
  }

  return { courses, loading, error, refresh: () => setTick((t) => t + 1) };
}
