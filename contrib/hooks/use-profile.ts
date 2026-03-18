import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function useProfile() {
  const [saving, setSaving] = useState(false);

  async function updateProfile(id: string, name: string, university: string, role: UserRole): Promise<string | null> {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), university: university.trim(), role })
      .eq('id', id);
    setSaving(false);
    return error ? error.message : null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return { updateProfile, signOut, saving };
}
