import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    async function redirect(session: { user: { id: string } }) {
      const returnTo = typeof router.query.returnTo === 'string' && router.query.returnTo.startsWith('/') && !router.query.returnTo.startsWith('//')
        ? router.query.returnTo : null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single();
      if (!profile) { router.replace('/onboarding'); return; }
      router.replace(returnTo ?? (profile.role === 'teacher' ? '/teacher' : '/dashboard'));
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        subscription.unsubscribe();
        await redirect(session);
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session yet — PKCE code exchange in progress, wait for SIGNED_IN
      } else if (!session) {
        router.replace('/login');
      }
    });

    const timeout = setTimeout(() => setTimedOut(true), 10000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [router]);

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-3">
      {timedOut ? (
        <>
          <p className="text-[15px] text-text font-medium">Sign-in is taking too long</p>
          <p className="text-sm text-text-secondary">Something may have gone wrong. Please try again.</p>
          <button onClick={() => router.push('/login')} className="mt-2 text-sm text-brand font-medium">Back to login</button>
        </>
      ) : (
        <p className="text-[15px] text-text-secondary">Signing you in…</p>
      )}
    </div>
  );
}
