import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
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

    // If role is changing, delegate validation and update to the server-side API
    if (current && current.role !== role) {
      try {
        const roleRes = await fetch('/api/profile/role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        if (!roleRes.ok) {
          const json = await roleRes.json().catch(() => ({}));
          setSaving(false);
          return json.error ?? 'Could not change role.';
        }
      } catch (err) {
        Sentry.captureException(err);
        setSaving(false);
        return 'Could not change role. Please check your connection and try again.';
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
