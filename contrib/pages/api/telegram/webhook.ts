import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface TelegramUpdate {
  message?: {
    from?: { id: number };
    chat?: { id: number };
    text?: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).end();
  }

  const update = req.body as TelegramUpdate;
  const text = update.message?.text?.trim().toUpperCase();
  const chatId = update.message?.chat?.id;

  if (!text || !chatId) return res.status(200).end();

  // Look up a pending verification matching this code
  const { data: sub } = await adminClient
    .from('telegram_subscriptions')
    .select('profile_id')
    .eq('verification_code', text)
    .eq('verified', false)
    .gt('verification_expires_at', new Date().toISOString())
    .single();

  if (!sub) {
    await sendTelegramMessage(String(chatId), 'Code not found or expired. Go back to Contrib and request a new code.');
    return res.status(200).end();
  }

  // Link this chat_id to the profile
  const { error: updateError } = await adminClient
    .from('telegram_subscriptions')
    .update({
      chat_id: String(chatId),
      verified: true,
      verification_code: null,
      verification_expires_at: null,
    })
    .eq('profile_id', sub.profile_id);

  if (updateError) {
    console.error('[telegram/webhook] verification update error:', updateError);
    await sendTelegramMessage(String(chatId), 'Something went wrong, please try again.');
    return res.status(200).end();
  }

  await sendTelegramMessage(
    String(chatId),
    'Connected! You will now receive Contrib notifications here.'
  );
  return res.status(200).end();
}
