import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, createCourseSchema } from '@/lib/validation';
import { generateInviteToken } from '@/lib/invite';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`courses-create:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { data: input, error: validationError } = validate(createCourseSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({ error: 'Profile not found.' });
  }
  if (profile.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create courses. Enable teacher mode in your profile first.' });
  }

  const inviteToken = generateInviteToken();
  const { data: course, error: insertError } = await adminClient
    .from('courses')
    .insert({
      name: input.name,
      subject: input.subject,
      teacher_id: user.id,
      invite_token: inviteToken,
    })
    .select('id, name, subject, teacher_id, invite_token, created_at')
    .single();

  if (insertError || !course) {
    Sentry.captureMessage(`[courses/create] insert error: ${insertError?.message ?? 'no row'}`, {
      level: 'error',
      tags: { route: 'courses/create' },
    });
    return res.status(500).json({ error: 'Failed to create course.' });
  }

  return res.status(200).json({ course });
}
