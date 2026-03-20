import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
        router.replace(!profile ? '/onboarding' : profile.role === 'teacher' ? '/teacher' : '/dashboard');
      } else if (event === 'INITIAL_SESSION' && session) {
        // Already signed in (e.g. user bookmarked /auth/callback)
        subscription.unsubscribe();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
        router.replace(!profile ? '/onboarding' : profile.role === 'teacher' ? '/teacher' : '/dashboard');
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session yet — PKCE code exchange in progress, wait for SIGNED_IN
      } else if (!session) {
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-dvh bg-[#F9FAFB] flex items-center justify-center">
      <p className="text-[15px] text-[#57534E]">Signing you in…</p>
    </div>
  );
}
