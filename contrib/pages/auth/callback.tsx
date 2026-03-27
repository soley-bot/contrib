import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'redirecting' | 'error';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const handled = useRef(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (handled.current) return;

    async function redirectWithSession(session: { user: { id: string } }) {
      if (handled.current) return;
      handled.current = true;
      setStatus('redirecting');

      const returnTo =
        typeof router.query.returnTo === 'string' &&
        router.query.returnTo.startsWith('/') &&
        !router.query.returnTo.startsWith('//')
          ? router.query.returnTo
          : null;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        if (!profile) {
          router.replace('/onboarding');
          return;
        }
        router.replace(
          returnTo ?? (profile.role === 'teacher' ? '/teacher' : '/dashboard')
        );
      } catch {
        // Profile fetch failed — retry once after 1s
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', session.user.id)
            .single();

          if (!profile) {
            router.replace('/onboarding');
            return;
          }
          router.replace(
            returnTo ?? (profile.role === 'teacher' ? '/teacher' : '/dashboard')
          );
        } catch {
          handled.current = false;
          setStatus('error');
          setErrorMsg('Could not load your profile. Please try again.');
        }
      }
    }

    async function init() {
      // 1. Check for existing session (handles back-button, already-authed)
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();
      if (existingSession) {
        await redirectWithSession(existingSession);
        return;
      }

      // 2. Validate URL has auth code (genuine OAuth callback)
      const url = new URL(window.location.href);
      const hasAuthCode = url.searchParams.has('code');
      const hasHashToken = window.location.hash.includes('access_token');

      if (!hasAuthCode && !hasHashToken) {
        setStatus('error');
        setErrorMsg('No sign-in detected. Please try again.');
        return;
      }

      // 3. Listen for PKCE code exchange completion
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
          session
        ) {
          subscription.unsubscribe();
          await redirectWithSession(session);
        } else if (event === 'INITIAL_SESSION' && !session) {
          // PKCE exchange still in progress — backup poll after 3s
          backupTimeoutRef.current = setTimeout(async () => {
            if (handled.current) return;
            const {
              data: { session: retrySession },
            } = await supabase.auth.getSession();
            if (retrySession) {
              subscription.unsubscribe();
              await redirectWithSession(retrySession);
            }
          }, 3000);
        }
      });

      subscriptionRef.current = subscription;

      // 4. Safety-net timeout: 60s for truly stuck states
      safetyTimeoutRef.current = setTimeout(() => {
        if (!handled.current) {
          subscription.unsubscribe();
          setStatus('error');
          setErrorMsg(
            'Sign-in is taking too long. Please check your connection and try again.'
          );
        }
      }, 60000);
    }

    init();

    return () => {
      subscriptionRef.current?.unsubscribe();
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (backupTimeoutRef.current) clearTimeout(backupTimeoutRef.current);
    };
  }, [router]);

  return (
    <div className="min-h-dvh bg-[#F8FAFF] flex flex-col items-center justify-center gap-3">
      {status === 'error' ? (
        <>
          <p className="text-[15px] text-[#0F172A] font-medium">
            Sign-in failed
          </p>
          <p className="text-sm text-[#475569]">{errorMsg}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-2 text-sm text-brand font-medium"
          >
            Back to login
          </button>
        </>
      ) : (
        <>
          <div className="h-5 w-5 border-2 border-[#1A56E8] border-t-transparent rounded-full animate-spin" />
          <p className="text-[15px] text-[#475569]">
            {status === 'redirecting'
              ? 'Redirecting...'
              : 'Signing you in...'}
          </p>
        </>
      )}
    </div>
  );
}
