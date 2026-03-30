import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createBlockerSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { notifyGroupMembers } from '@/lib/notify';

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
        const cookieHeader = req.headers.cookie ?? '';
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
          res.appendHeader('Set-Cookie', parts.join('; '));
        });
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`blockers:${ip}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group.' });

  // Verify user is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) return res.status(403).json({ error: 'You are not a member of this group.' });

  // Validate input
  const parsed = createBlockerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }

  const { reason } = parsed.data;

  // Insert blocker declaration
  const { error: blockerError } = await adminClient
    .from('blocker_declarations')
    .insert({ group_id: groupId, profile_id: user.id, reason });

  if (blockerError) {
    console.error('[blockers] insert error:', blockerError);
    return res.status(500).json({ error: 'Failed to save declaration.' });
  }

  // Log to activity timeline
  const { error: logError } = await adminClient
    .from('activity_log')
    .insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'blocker_declared',
      task_id: null,
      meta: { reason },
    });

  if (logError) {
    console.error('[blockers] activity log error:', logError);
    // Non-fatal — declaration saved, just log the error
  }

  // Notify group members via Telegram (non-fatal, fire and forget)
  const { data: actor } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  notifyGroupMembers(
    groupId,
    `${actor?.name ?? 'A teammate'} sent a heads up: ${reason}`,
    user.id,
  ).catch((err) => console.error('[blockers] notify error:', err));

  return res.status(201).json({ ok: true });
}
