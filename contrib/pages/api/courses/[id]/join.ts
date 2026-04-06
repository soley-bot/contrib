import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`course-join:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const courseId = req.query.id;
  if (typeof courseId !== 'string') return res.status(400).json({ error: 'Invalid course ID.' });

  // Check caller's role — only students can join courses
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return res.status(403).json({ error: 'Profile not found. Complete onboarding first.' });
  if (profile.role !== 'student') return res.status(403).json({ error: 'Only students can join courses.' });

  // Require invite token — prevents joining by guessing course ID
  const { inviteToken } = req.body ?? {};
  if (typeof inviteToken !== 'string' || !inviteToken) {
    return res.status(400).json({ error: 'Invite token is required.' });
  }

  // Verify the course exists and invite token matches
  const { data: course } = await adminClient
    .from('courses')
    .select('id, invite_token')
    .eq('id', courseId)
    .single();

  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (course.invite_token !== inviteToken) {
    return res.status(403).json({ error: 'Invalid invite link.' });
  }

  // Check if already a member
  const { data: existing } = await adminClient
    .from('course_members')
    .select('id')
    .eq('course_id', courseId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) return res.status(200).json({ already: true });

  // Insert membership
  const { error: insertError } = await adminClient
    .from('course_members')
    .insert({ course_id: courseId, profile_id: user.id });

  if (insertError) {
    if (insertError.code === '23505') return res.status(200).json({ already: true });
    Sentry.captureMessage(`[course-join] insert error: ${insertError.message}`, {
      level: 'error',
      tags: { route: 'course-join' },
    });
    return res.status(500).json({ error: 'Failed to join course.' });
  }

  return res.status(200).json({ joined: true });
}
