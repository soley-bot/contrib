import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validate, onboardSchema } from '@/lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`onboard:${ip}`, 5, 60_000))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { data: input, error: validationError } = validate(onboardSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid input.' });

  // Check if profile already exists — prevent re-onboarding to change role
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfile) return res.status(409).json({ error: 'Profile already exists.' });

  // Get avatar URL from auth metadata
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(user.id);
  const avatarUrl = authUser?.user_metadata?.avatar_url ?? null;

  const { error: insertError } = await adminClient
    .from('profiles')
    .insert({
      id: user.id,
      name: input.name,
      university: input.university,
      faculty: input.faculty,
      year_of_study: input.year_of_study ?? null,
      avatar_url: avatarUrl,
      role: input.role,
    });

  if (insertError) {
    if (insertError.code === '23505') return res.status(409).json({ error: 'Profile already exists.' });
    Sentry.captureMessage(`[profile/onboard] insert error: ${insertError.message}`, {
      level: 'error',
      tags: { route: 'profile-onboard' },
    });
    return res.status(500).json({ error: 'Failed to create profile.' });
  }

  return res.status(200).json({ ok: true });
}
