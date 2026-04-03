import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

interface UseCourseMembershipsResult {
  courses: Course[];
  loading: boolean;
  refresh: () => void;
}

export function useCourseMemberships(userId: string | undefined): UseCourseMembershipsResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('course_members')
      .select('course:courses(id, name, subject, teacher_id, created_at)')
      .eq('profile_id', userId)
      .then(({ data, error }) => {
        if (error) {
          Sentry.captureMessage(`Failed to load course memberships: ${error.message}`, { level: 'error' });
        } else if (data) {
          setCourses(data.map((row: { course: unknown }) => row.course as Course).filter(Boolean));
        }
        setLoading(false);
      });
  }, [userId, tick]);

  return { courses, loading, refresh: () => setTick((t) => t + 1) };
}
