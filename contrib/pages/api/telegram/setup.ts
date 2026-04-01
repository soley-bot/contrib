import type { NextApiRequest, NextApiResponse } from 'next';
import { setWebhook } from '@/lib/telegram';

/**
 * Visit /api/telegram/setup once after deploying to production.
 * Registers the webhook URL with Telegram so the bot can receive messages.
 * Protect with SETUP_SECRET to prevent accidental re-registration.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { secret } = req.query;
  const setupSecret = process.env.TELEGRAM_SETUP_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret !== setupSecret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const host = req.headers.host;
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

  const ok = await setWebhook(webhookUrl);
  if (!ok) {
    return res.status(500).json({ error: 'Failed to register webhook with Telegram.' });
  }

  return res.status(200).json({ ok: true, webhookUrl });
}
