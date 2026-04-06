import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const bodySchema = z.object({
  role: z.enum(['student', 'teacher']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`profile-role:${ip}`, 5, 60_000))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  const { role: newRole } = parsed.data;

  try {
    // Fetch current role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // No-op if role unchanged
    if (profile.role === newRole) {
      return res.status(200).json({ ok: true, role: newRole });
    }

    // Lock check: if user has group memberships, they cannot change role
    const { count: groupCount } = await adminClient
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id);

    if ((groupCount ?? 0) > 0) {
      return res.status(409).json({
        error: 'Your role is locked because you are in one or more groups. Leave all groups to switch.',
      });
    }

    // Lock check: if user owns courses, they cannot change role
    const { count: courseCount } = await adminClient
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', user.id);

    if ((courseCount ?? 0) > 0) {
      return res.status(409).json({
        error: 'Your role is locked because you own one or more courses. Delete all courses to switch back.',
      });
    }

    // Apply the role change
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (updateError) {
      Sentry.captureException(updateError);
      return res.status(500).json({ error: 'Could not update role.' });
    }

    return res.status(200).json({ ok: true, role: newRole });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({ error: 'Unexpected error.' });
  }
}
