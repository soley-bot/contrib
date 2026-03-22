import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required.' });
  }

  const { data, error } = await adminClient
    .from('groups')
    .select('id, name, subject, lead_id')
    .eq('invite_token', token)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  return res.status(200).json(data);
}
