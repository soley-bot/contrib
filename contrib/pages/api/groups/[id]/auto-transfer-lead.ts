import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';

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
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

/**
 * POST /api/groups/[id]/auto-transfer-lead
 * When a student joins a group created by a teacher (Flow 2),
 * automatically transfer leadership from the teacher to the student.
 * Only works if the current lead is a teacher.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  // Verify the group exists and the current lead is a teacher
  const { data: group } = await adminClient
    .from('groups')
    .select('id, lead_id')
    .eq('id', groupId)
    .single();

  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const { data: leadProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', group.lead_id)
    .single();

  if (!leadProfile || leadProfile.role !== 'teacher') {
    return res.status(200).json({ transferred: false, reason: 'Lead is not a teacher.' });
  }

  // Verify the caller is a member of this group
  const { data: membership } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  if (!membership) {
    return res.status(403).json({ error: 'You must be a member of this group.' });
  }

  // Transfer leadership to the joining student
  const { error: updateError } = await adminClient
    .from('groups')
    .update({ lead_id: user.id })
    .eq('id', groupId);

  if (updateError) return res.status(500).json({ error: 'Failed to transfer leadership.' });

  // Remove the teacher from group_members
  await adminClient
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', group.lead_id);

  return res.status(200).json({ transferred: true });
}
