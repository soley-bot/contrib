import Link from 'next/link';
import type { GetServerSidePropsContext } from 'next';
import { createServerClient } from '@/lib/supabase-server';

/**
 * OAuth callback — exchanges the PKCE code server-side and redirects.
 * The component below is only a fallback if getServerSideProps doesn't redirect.
 */
export default function AuthCallback() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-3">
      <p className="text-[15px] text-text font-medium">Sign-in failed</p>
      <p className="text-sm text-text-secondary">Something went wrong. Please try again.</p>
      <Link href="/login" className="mt-2 text-sm text-brand font-medium">Back to login</Link>
    </div>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const code = ctx.query.code;
  if (typeof code !== 'string') {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const supabase = createServerClient(ctx);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return { props: {} }; // render fallback error UI
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  // Determine redirect destination
  const returnTo = typeof ctx.query.returnTo === 'string'
    && ctx.query.returnTo.startsWith('/') && !ctx.query.returnTo.startsWith('//')
    ? ctx.query.returnTo : null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    return { redirect: { destination: '/onboarding', permanent: false } };
  }

  const destination = returnTo ?? (profile.role === 'teacher' ? '/teacher' : '/dashboard');
  return { redirect: { destination, permanent: false } };
}
