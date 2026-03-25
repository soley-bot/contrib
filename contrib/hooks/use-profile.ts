import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function useProfile() {
  const [saving, setSaving] = useState(false);

  async function updateProfile(id: string, name: string, university: string, role: UserRole, faculty?: string, year_of_study?: string): Promise<string | null> {
    setSaving(true);

    // Fetch the current profile to detect role change attempts
    const { data: current, error: fetchErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single();

    if (fetchErr) { setSaving(false); return fetchErr.message; }

    // If role is changing, verify user has no active groups or courses
    if (current && current.role !== role) {
      const { count: groupCount } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', id);

      if ((groupCount ?? 0) > 0) {
        setSaving(false);
        return 'Your role is locked because you have active groups or courses.';
      }

      const { count: courseCount } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', id);

      if ((courseCount ?? 0) > 0) {
        setSaving(false);
        return 'Your role is locked because you have active groups or courses.';
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), university: university.trim(), role, faculty: faculty ?? null, year_of_study: year_of_study ?? null })
      .eq('id', id);
    setSaving(false);
    return error ? error.message : null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return { updateProfile, signOut, saving };
}
