import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { joinLookupSchema } from '@/lib/validation';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

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
    console.error('[join/lookup] error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
