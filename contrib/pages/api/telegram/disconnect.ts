import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`tg-disconnect:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { error } = await adminClient
    .from('telegram_subscriptions')
    .update({ chat_id: null, verified: false, verification_code: null })
    .eq('profile_id', user.id);

  if (error) {
    Sentry.captureMessage(`[telegram/disconnect] update error: ${error.message}`, { level: 'error', tags: { route: 'telegram/disconnect' } });
    return res.status(500).json({ error: 'Failed to disconnect. Try again.' });
  }

  return res.status(200).json({ ok: true });
}
