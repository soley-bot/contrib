import { useState, useEffect } from 'react';
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

export function useCourse(courseId: string | undefined, userId: string | undefined): UseCourseResult {
  const [course, setCourse] = useState<Course | null>(null);
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!courseId || !userId) { setLoading(false); return; }
    setLoading(true);
    fetchAll(courseId).finally(() => setLoading(false));
  }, [courseId, userId, tick]);

  async function fetchAll(id: string) {
    const [{ data: courseData, error: courseError }, { data: groupData, error: groupError }] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).single(),
      supabase.from('groups').select('*').eq('course_id', id).order('created_at', { ascending: false }),
    ]);
    if (courseError) {
      console.error('Failed to load course:', courseError);
      setError('Failed to load data.');
      return;
    }
    if (groupError) {
      console.error('Failed to load course groups:', groupError);
      setError('Failed to load data.');
      return;
    }
    setError(null);
    setCourse((courseData as Course) ?? null);
    if (!groupData || groupData.length === 0) { setGroups([]); return; }

    const groupIds = (groupData as Group[]).map((g) => g.id);
    const [{ data: membersData, error: membersError }, { data: tasksData, error: tasksError }] = await Promise.all([
      supabase.from('group_members').select('group_id').in('group_id', groupIds),
      supabase.from('tasks').select('group_id, status').in('group_id', groupIds),
    ]);
    if (membersError) {
      console.error('Failed to load course members:', membersError);
      setError('Failed to load data.');
      return;
    }
    if (tasksError) {
      console.error('Failed to load course tasks:', tasksError);
      setError('Failed to load data.');
      return;
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

    setGroups(
      (groupData as Group[]).map((g) => ({
        group: g,
        memberCount: memberCounts[g.id] ?? 0,
        taskTotal: taskTotal[g.id] ?? 0,
        taskDone: taskDone[g.id] ?? 0,
      }))
    );
  }

  const isOwner = !!course && course.teacher_id === userId;
  return { course, groups, isOwner, loading, error, refresh: () => setTick((t) => t + 1) };
}
