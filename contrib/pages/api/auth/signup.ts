import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { signupSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit: 5 signup attempts per IP per minute
  const ip = getClientIp(req.headers);
  if (!rateLimit(`signup:${ip}`, RATE_LIMITS.SIGNUP.limit, RATE_LIMITS.SIGNUP.window)) {
    return res.status(429).json({ error: 'Too many signup attempts. Please wait a moment.' });
  }

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }
  const input = parsed.data;

  try {
    // Create auth user without sending a confirmation email
    const { data, error: createError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (createError || !data.user) {
      return res.status(400).json({ error: createError?.message ?? 'Failed to create user.' });
    }

    // Insert profile
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: data.user.id,
      name: input.name,
      university: input.university,
      role: input.role,
    });

    if (profileError) {
      // Roll back the auth user if profile insert fails
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
      if (deleteError) {
        Sentry.captureMessage(`[signup] rollback deleteUser failed for ${data.user.id}: ${deleteError.message}`, { level: 'error', tags: { route: 'signup' } });
      }
      return res.status(500).json({ error: 'Failed to create profile. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'signup' } });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
