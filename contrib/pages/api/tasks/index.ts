import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(*)')
      .eq('group_id', group_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tasks: data ?? [] });
  }

  res.status(405).end();
}
