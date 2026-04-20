import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

interface RoleLockState {
  locked: boolean;
  reason: 'groups' | 'courses' | null;
  loading: boolean;
}

/**
 * Check whether the user's role is locked due to active groups (student)
 * or active courses (teacher). Role becomes immutable after first action.
 */
async function checkRoleLock([, userId, role]: [string, string, string]): Promise<RoleLockState> {
  // Check group_members for student lock. Archived-group memberships are
  // kept for history (see /api/groups/create) and must NOT count toward the
  // role lock — a student whose only group is archived should still be
  // able to switch to teacher mode.
  const { count: groupCount, error: groupErr } = await supabase
    .from('group_members')
    .select('id, groups!inner(archived_at)', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .is('groups.archived_at', null);

  if (!groupErr && (groupCount ?? 0) > 0) {
    return { locked: true, reason: 'groups', loading: false };
  }

  // Check courses for teacher lock
  const { count: courseCount, error: courseErr } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', userId);

  if (!courseErr && (courseCount ?? 0) > 0) {
    return { locked: true, reason: 'courses', loading: false };
  }

  void role; // included in key so check reruns when role changes
  return { locked: false, reason: null, loading: false };
}

export function useRoleLock(userId: string | undefined, role: string | undefined): RoleLockState {
  const key = userId && role ? ['role-lock', userId, role] : null;
  const { data, isLoading } = useSWR(key, checkRoleLock);

  return data ?? (isLoading ? { locked: false, reason: null, loading: true } : { locked: false, reason: null, loading: false });
}
