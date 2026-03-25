import { createServerClient as createSSRClient } from '@supabase/ssr';
import type { GetServerSidePropsContext } from 'next';

/**
 * Create a Supabase client for server-side use in getServerSideProps.
 * Uses @supabase/ssr to properly read/write auth cookies in Pages Router.
 */
export function createServerClient(ctx: GetServerSidePropsContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        const cookieHeader = ctx.req.headers.cookie ?? '';
        return cookieHeader.split(';').map((c) => {
          const [name, ...rest] = c.trim().split('=');
          return { name: name ?? '', value: decodeURIComponent(rest.join('=') || '') };
        }).filter((c) => c.name);
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          const parts = [`${name}=${encodeURIComponent(value)}`];
          if (options?.path) parts.push(`Path=${options.path}`);
          if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
          if (options?.httpOnly) parts.push('HttpOnly');
          if (options?.secure) parts.push('Secure');
          if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
          ctx.res.appendHeader('Set-Cookie', parts.join('; '));
        });
      },
    },
  });
}

/**
 * Redirect helper for getServerSideProps — sends unauthenticated users to login.
 */
export const redirectToLogin = {
  redirect: { destination: '/login', permanent: false } as const,
};

export const redirectToDashboard = {
  redirect: { destination: '/dashboard', permanent: false } as const,
};

export const redirectToTeacher = {
  redirect: { destination: '/teacher', permanent: false } as const,
};

/**
 * Require authenticated session in getServerSideProps.
 * Returns the user ID or a redirect to login.
 */
export async function requireAuth(ctx: GetServerSidePropsContext) {
  const supabase = createServerClient(ctx);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { redirect: redirectToLogin.redirect, user: null, profile: null };
  }

  // Fetch profile for role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', session.user.id)
    .single();

  return { redirect: null, user: session.user, profile };
}

/**
 * Require teacher role in getServerSideProps.
 */
export async function requireTeacher(ctx: GetServerSidePropsContext) {
  const result = await requireAuth(ctx);
  if (result.redirect) return result;
  if (!result.profile || result.profile.role !== 'teacher') {
    return { ...result, redirect: redirectToDashboard.redirect };
  }
  return result;
}

/**
 * Require student role in getServerSideProps.
 */
export async function requireStudent(ctx: GetServerSidePropsContext) {
  const result = await requireAuth(ctx);
  if (result.redirect) return result;
  if (result.profile && result.profile.role === 'teacher') {
    return { ...result, redirect: redirectToTeacher.redirect };
  }
  return result;
}
