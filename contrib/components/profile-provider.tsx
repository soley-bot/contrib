import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface ProfileContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, university, faculty, year_of_study, avatar_url, role, created_at')
    .eq('id', id)
    .single();
  if (error) {
    Sentry.captureMessage(`fetchProfile failed: ${error.message}`, 'warning');
    return null;
  }
  return data ?? null;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const {
    data: profile = null,
    isLoading: swrIsLoading,
    mutate,
  } = useSWR<Profile | null>(
    user ? ['profile', user.id] : null,
    ([, id]: [string, string]) => fetchProfile(id),
  );

  const loading = loadingAuth || (user !== null && swrIsLoading);

  function refreshProfile() {
    void mutate();
  }

  return (
    <ProfileContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return ctx;
}
