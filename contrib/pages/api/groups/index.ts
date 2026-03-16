import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data, error } = await supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('profile_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ groups: data?.map((r: { group: unknown }) => r.group) ?? [] });
  }

  res.status(405).end();
}
