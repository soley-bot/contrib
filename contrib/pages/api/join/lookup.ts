import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { joinLookupSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  // Rate limit: 30 lookups per IP per minute
  const ip = getClientIp(req.headers);
  if (!rateLimit(`lookup:${ip}`, RATE_LIMITS.JOIN_LOOKUP.limit, RATE_LIMITS.JOIN_LOOKUP.window)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const parsed = joinLookupSchema.safeParse({ token: req.query.token });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }
  const input = parsed.data;

  try {
    const { data, error } = await adminClient
      .from('groups')
      .select('id, name, subject, lead_id')
      .eq('invite_token', input.token)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    return res.status(200).json(data);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'join/lookup' } });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
