import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { getBotUsername } from '@/lib/telegram';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`tg-connect:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from('telegram_subscriptions')
    .upsert({
      profile_id: user.id,
      verification_code: code,
      verification_expires_at: expiresAt,
      verified: false,
      chat_id: null,
    }, { onConflict: 'profile_id' });

  if (error) {
    Sentry.captureMessage(`[tg/connect] upsert error: ${error.message}`, { level: 'error', tags: { route: 'telegram/connect' } });
    return res.status(500).json({ error: 'Failed to generate code.' });
  }

  const botUsername = await getBotUsername();
  return res.status(200).json({ code, botUsername });
}
