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

  // Handle /start and /help commands
  if (text === '/START') {
    // Check if already connected
    const { data: existing } = await adminClient
      .from('telegram_subscriptions')
      .select('verified')
      .eq('chat_id', String(chatId))
      .eq('verified', true)
      .maybeSingle();

    if (existing) {
      await sendTelegramMessage(String(chatId), 'You are already connected to Contrib. You will receive notifications here when things happen in your groups.');
    } else {
      await sendTelegramMessage(String(chatId), 'Welcome to Contrib notifications!\n\nTo connect, go to your profile at joincontrib.com and click "Connect Telegram". You will get a 6-character code to send here.');
    }
    return res.status(200).end();
  }

  if (text === '/HELP') {
    await sendTelegramMessage(String(chatId), 'Contrib sends you notifications when:\n- A task is assigned to you\n- A group member declares a blocker\n- A deadline is approaching\n- A peer review is opened\n\nTo connect: go to joincontrib.com/profile and click "Connect Telegram".\nTo disconnect: use the same page.\n\nThis bot is one-way — it sends notifications only. For questions, visit joincontrib.com.');
    return res.status(200).end();
  }

  // If it doesn't look like a 6-char verification code, give a helpful response
  if (text.length !== 6 || !/^[A-Z0-9]+$/.test(text)) {
    await sendTelegramMessage(String(chatId), 'I only understand verification codes from Contrib. Go to joincontrib.com/profile and click "Connect Telegram" to get your code.');
    return res.status(200).end();
  }

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
