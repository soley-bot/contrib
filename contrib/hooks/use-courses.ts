import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

interface UseCoursesResult {
  courses: Course[];
  loading: boolean;
  refresh: () => void;
}

export function useCourses(teacherId: string | undefined): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!teacherId) { setLoading(false); return; }
    setLoading(true);
    fetchCourses(teacherId).finally(() => setLoading(false));
  }, [teacherId, tick]);

  async function fetchCourses(id: string) {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('teacher_id', id)
      .order('created_at', { ascending: false });
    setCourses((data as Course[]) ?? []);
  }

  return { courses, loading, refresh: () => setTick((t) => t + 1) };
}
