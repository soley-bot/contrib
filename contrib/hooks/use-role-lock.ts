import { useState, useEffect } from 'react';
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
export function useRoleLock(userId: string | undefined, role: string | undefined): RoleLockState {
  const [state, setState] = useState<RoleLockState>({ locked: false, reason: null, loading: true });

  useEffect(() => {
    if (!userId || !role) {
      setState({ locked: false, reason: null, loading: false });
      return;
    }

    let cancelled = false;

    async function check() {
      // Check group_members for student lock
      const { count: groupCount, error: groupErr } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', userId!);

      if (cancelled) return;

      if (!groupErr && (groupCount ?? 0) > 0) {
        setState({ locked: true, reason: 'groups', loading: false });
        return;
      }

      // Check courses for teacher lock
      const { count: courseCount, error: courseErr } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId!);

      if (cancelled) return;

      if (!courseErr && (courseCount ?? 0) > 0) {
        setState({ locked: true, reason: 'courses', loading: false });
        return;
      }

      setState({ locked: false, reason: null, loading: false });
    }

    check();
    return () => { cancelled = true; };
  }, [userId, role]);

  return state;
}
