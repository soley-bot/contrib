import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, roleChangeSchema } from '@/lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`profile-role:${ip}`, RATE_LIMITS.PROFILE_ROLE.limit, RATE_LIMITS.PROFILE_ROLE.window))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { data: input, error: validationError } = validate(roleChangeSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid input.' });
  const { role: newRole } = input;

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

    // Lock check: if user has ACTIVE (non-archived) group memberships, they
    // cannot change role. Archived memberships are historical and must not
    // block the switch — matches the hook in use-role-lock.ts.
    const { count: groupCount } = await adminClient
      .from('group_members')
      .select('id, groups!inner(archived_at)', { count: 'exact', head: true })
      .eq('profile_id', user.id)
      .is('groups.archived_at', null);

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
