import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { getBotUsername } from '@/lib/telegram';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function getUser(req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        return (req.headers.cookie ?? '').split(';').map((c) => {
          const [name, ...rest] = c.trim().split('=');
          return { name: name ?? '', value: decodeURIComponent(rest.join('=') || '') };
        }).filter((c) => c.name);
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          const parts = [`${name}=${encodeURIComponent(value)}`];
          if (options?.path) parts.push(`Path=${options.path}`);
          if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
          if (options?.httpOnly) parts.push('HttpOnly');
          if (options?.secure) parts.push('Secure');
          if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
          res.appendHeader('Set-Cookie', parts.join('; '));
        });
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!rateLimit(`tg-connect:${ip}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUser(req, res);
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
    console.error('[tg/connect] upsert error:', error);
    return res.status(500).json({ error: 'Failed to generate code.' });
  }

  const botUsername = await getBotUsername();
  return res.status(200).json({ code, botUsername });
}
