import * as Sentry from '@sentry/nextjs';

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Send a plain-text message to a Telegram chat.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      Sentry.captureMessage(`[telegram] sendMessage failed: ${body}`, { level: 'error', tags: { route: 'telegram' } });
    }
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'telegram' } });
    return false;
  }
}

/**
 * Fetch the bot's username from Telegram (used to show the user where to message).
 */
export async function getBotUsername(): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/getMe`);
    const data = await res.json() as { result?: { username?: string } };
    return data.result?.username ?? 'ContribBot';
  } catch {
    return 'ContribBot';
  }
}

/**
 * Register the webhook URL with Telegram.
 * Call this once after deploying to production.
 */
export async function setWebhook(url: string): Promise<boolean> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const res = await fetch(`${BASE_URL}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret }),
  });
  return res.ok;
}
