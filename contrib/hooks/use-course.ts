import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Course, Group, GroupWithStats } from '@/types';

interface UseCourseResult {
  course: Course | null;
  groups: GroupWithStats[];
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface CourseData {
  course: Course;
  groups: GroupWithStats[];
}

async function fetchCourse(courseId: string): Promise<CourseData> {
  const [{ data: courseData, error: courseError }, { data: groupData, error: groupError }] = await Promise.all([
    supabase.from('courses').select('id, name, subject, teacher_id, invite_token, created_at').eq('id', courseId).single(),
    supabase.from('groups').select('id, name, subject, due_date, lead_id, course_id, invite_token, created_at').eq('course_id', courseId).order('created_at', { ascending: false }),
  ]);
  if (courseError) {
    Sentry.captureMessage(`Failed to load course: ${courseError.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  if (groupError) {
    Sentry.captureMessage(`Failed to load course groups: ${groupError.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }

  if (!groupData || groupData.length === 0) {
    return { course: courseData as Course, groups: [] };
  }

  const groupIds = (groupData as Group[]).map((g) => g.id);
  const [{ data: membersData, error: membersError }, { data: tasksData, error: tasksError }] = await Promise.all([
    supabase.from('group_members').select('group_id').in('group_id', groupIds),
    supabase.from('tasks').select('group_id, status').in('group_id', groupIds).is('deleted_at', null),
  ]);
  if (membersError) {
    Sentry.captureMessage(`Failed to load course members: ${membersError.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }
  if (tasksError) {
    Sentry.captureMessage(`Failed to load course tasks: ${tasksError.message}`, { level: 'error' });
    throw new Error('Failed to load data.');
  }

  const memberCounts: Record<string, number> = {};
  const taskTotal: Record<string, number> = {};
  const taskDone: Record<string, number> = {};
  groupIds.forEach((gid) => { memberCounts[gid] = 0; taskTotal[gid] = 0; taskDone[gid] = 0; });

  (membersData ?? []).forEach((row: { group_id: string }) => {
    memberCounts[row.group_id] = (memberCounts[row.group_id] ?? 0) + 1;
  });
  (tasksData ?? []).forEach((row: { group_id: string; status: string }) => {
    taskTotal[row.group_id] = (taskTotal[row.group_id] ?? 0) + 1;
    if (row.status === 'done') taskDone[row.group_id] = (taskDone[row.group_id] ?? 0) + 1;
  });

  const groups = (groupData as Group[]).map((g) => ({
    group: g,
    memberCount: memberCounts[g.id] ?? 0,
    taskTotal: taskTotal[g.id] ?? 0,
    taskDone: taskDone[g.id] ?? 0,
  }));

  return { course: courseData as Course, groups };
}

export function useCourse(courseId: string | undefined, userId: string | undefined): UseCourseResult {
  const key = courseId ? ['course', courseId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([, id]) => fetchCourse(id));

  const isOwner = data?.course.teacher_id === userId;

  return {
    course: data?.course ?? null,
    groups: data?.groups ?? [],
    isOwner,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => { void mutate(); },
  };
}
