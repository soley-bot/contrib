import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { generateInviteToken } from '@/lib/invite';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`reset-course-invite:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
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

  if (error) {
    Sentry.captureMessage(`[courses/reset-invite] update error: ${error.message}`, { level: 'error', tags: { route: 'courses/reset-invite' } });
    return res.status(500).json({ error: 'Failed to reset invite link.' });
  }

  return res.status(200).json({ invite_token: newToken });
}
