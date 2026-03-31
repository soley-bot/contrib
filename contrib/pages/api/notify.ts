import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { notifyGroupMembers } from '@/lib/notify';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type NotificationType = 'contributions' | 'blockers' | 'deadlines' | 'weekly_digest';

const ALLOWED_TYPES: NotificationType[] = ['contributions', 'blockers', 'deadlines', 'weekly_digest'];

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
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { groupId, message, type } = req.body as {
    groupId?: string;
    message?: string;
    type?: string;
  };

  if (!groupId || !message || !type) {
    return res.status(400).json({ error: 'Missing groupId, message, or type.' });
  }

  if (!ALLOWED_TYPES.includes(type as NotificationType)) {
    return res.status(400).json({ error: 'Invalid notification type.' });
  }

  // Verify user is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

  await notifyGroupMembers(groupId, message, type as NotificationType, user.id);

  return res.status(200).json({ ok: true });
}
