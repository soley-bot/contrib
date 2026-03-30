import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { generateInviteToken } from '@/lib/invite';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getUser(req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        return (req.headers.cookie ?? '').split(';').map((c) => {
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
          res.appendHeader('Set-Cookie', parts.join('; '));
        });
      },
    },
  });
  const { data: { session } } = await client.auth.getSession();
  return session?.user ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`reset-course-invite:${ip}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const courseId = req.query.id;
  if (typeof courseId !== 'string') return res.status(400).json({ error: 'Invalid course ID.' });

  // Verify caller is the course teacher
  const { data: course } = await adminClient
    .from('courses')
    .select('id, teacher_id')
    .eq('id', courseId)
    .single();

  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (course.teacher_id !== user.id) return res.status(403).json({ error: 'Only the course teacher can reset the invite link.' });

  const newToken = generateInviteToken();
  const { error } = await adminClient
    .from('courses')
    .update({ invite_token: newToken })
    .eq('id', courseId);

  if (error) return res.status(500).json({ error: 'Failed to reset invite link.' });

  return res.status(200).json({ invite_token: newToken });
}
