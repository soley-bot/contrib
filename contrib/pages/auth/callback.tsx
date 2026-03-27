import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const redirectFromSession = useCallback(async (session: { user: { id: string } }) => {
    const returnTo = typeof router.query.returnTo === 'string' && router.query.returnTo.startsWith('/') && !router.query.returnTo.startsWith('//')
      ? router.query.returnTo : null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .single();
    if (!profile) { router.replace('/onboarding'); return; }
    router.replace(returnTo ?? (profile.role === 'teacher' ? '/teacher' : '/dashboard'));
  }, [router]);

  async function tryRecoverSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await redirectFromSession(session);
      return true;
    }
    return false;
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        subscription.unsubscribe();
        await redirectFromSession(session);
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session yet — PKCE code exchange in progress, wait for SIGNED_IN
      } else if (!session) {
        router.replace('/login');
      }
    });

    const timeout = setTimeout(async () => {
      // Recovery: PKCE exchange may have completed but event was missed
      const recovered = await tryRecoverSession();
      if (!recovered) setTimedOut(true);
    }, 10000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, redirectFromSession]);

  async function handleRetry() {
    setRetrying(true);
    const recovered = await tryRecoverSession();
    if (!recovered) {
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFF] flex flex-col items-center justify-center gap-3">
      {timedOut ? (
        <>
          <p className="text-[15px] text-[#0F172A] font-medium">Sign-in is taking too long</p>
          <p className="text-sm text-[#475569]">Something may have gone wrong. Please try again.</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="text-sm text-white bg-brand hover:bg-brand-hover px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-60"
            >
              {retrying ? 'Checking…' : 'Try again'}
            </button>
            <button onClick={() => router.push('/login')} className="text-sm text-brand font-medium">
              Back to login
            </button>
          </div>
        </>
      ) : (
        <>
          <svg className="animate-spin h-8 w-8 text-brand" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[15px] text-[#475569]">Signing you in…</p>
        </>
      )}
    </div>
  );
}
