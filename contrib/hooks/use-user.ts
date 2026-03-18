import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface UseUserResult {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id ?? null;
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id ?? null;
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(id: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    setProfile(data ?? null);
    setLoading(false);
  }

  function refreshProfile() {
    if (userIdRef.current) fetchProfile(userIdRef.current);
  }

  return { user, profile, loading, refreshProfile };
}
