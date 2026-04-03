import { createServerClient as createSSRClient } from '@supabase/ssr';
import type { GetServerSidePropsContext } from 'next';
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminClient } from './supabase-admin';

/**
 * Create a Supabase client for server-side use in getServerSideProps.
 * Uses @supabase/ssr to properly read/write auth cookies in Pages Router.
 */
export function createServerClient(ctx: GetServerSidePropsContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Track cookies written via setAll so getAll sees them in the same request.
  // Without this, exchangeCodeForSession writes tokens to the response but
  // subsequent PostgREST calls still read stale request cookies → auth.uid() is null.
  const cookieStore = new Map<string, string>();

  return createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        const parsed = (ctx.req.headers.cookie ?? '').split(';').map((c) => {
          const [name, ...rest] = c.trim().split('=');
          return { name: name ?? '', value: decodeURIComponent(rest.join('=') || '') };
        }).filter((c) => c.name);

        // Overlay cookies written via setAll during this request
        const merged = new Map(parsed.map((c) => [c.name, c.value]));
        for (const [name, value] of cookieStore) {
          merged.set(name, value);
        }
        return Array.from(merged, ([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          cookieStore.set(name, value);
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { redirect: redirectToLogin.redirect, user: null, profile: null };
  }

  // Fetch profile for role check — use adminClient to bypass RLS
  // (user identity already verified via getUser() above)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single();

  // User exists in auth but hasn't completed onboarding
  if (!profile) {
    // Allow access to /onboarding itself (avoid redirect loop)
    const path = ctx.resolvedUrl?.split('?')[0] ?? '';
    if (path === '/onboarding') {
      return { redirect: null, user, profile: null };
    }
    return {
      redirect: { destination: '/onboarding', permanent: false } as const,
      user,
      profile: null,
    };
  }

  return { redirect: null, user, profile };
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

/**
 * Extract user from Supabase auth cookie in an API route handler.
 * Uses @supabase/ssr for proper cookie handling (matches getServerSideProps pattern).
 */
export async function getUserFromApiRoute(req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = new Map<string, string>();
  const client = createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        const parsed = (req.headers.cookie ?? '').split(';').map((c) => {
          const [name, ...rest] = c.trim().split('=');
          return { name: name ?? '', value: decodeURIComponent(rest.join('=') || '') };
        }).filter((c) => c.name);
        const merged = new Map(parsed.map((c) => [c.name, c.value]));
        for (const [name, value] of cookieStore) {
          merged.set(name, value);
        }
        return Array.from(merged, ([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          cookieStore.set(name, value);
          const parts = [`${name}=${encodeURIComponent(value)}`];
          if (options?.path) parts.push(`Path=${options.path}`);
          if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
          if (options?.httpOnly) parts.push('HttpOnly');
          if (options?.secure) parts.push('Secure');
          if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
          res.appendHeader('Set-Cookie', parts.join('; '));
        });
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}
