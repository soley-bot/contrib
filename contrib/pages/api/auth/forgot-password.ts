import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit: 10 requests per IP per minute
  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`forgot-password:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
    // Use the admin client's non-admin auth to send the reset email via Supabase's built-in mailer
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${origin}/reset-password` },
    );

    if (resetError) {
      // Log but don't expose — prevent email enumeration
      Sentry.captureMessage(`[forgot-password] ${resetError.message}`, {
        level: 'warning',
        tags: { route: 'forgot-password' },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'forgot-password' } });
  }

  // Always return 200 to prevent email enumeration
  return res.status(200).json({ ok: true });
}
