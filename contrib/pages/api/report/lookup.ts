import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { reportLookupSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  // Rate limit: 20 lookups per IP per minute
  const ip = getClientIp(req.headers);
  if (!rateLimit(`report-lookup:${ip}`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const parsed = reportLookupSchema.safeParse({ token: req.query.token });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }
  const { token } = parsed.data;

  try {
    // Look up the share token
    const { data: share, error: shareError } = await adminClient
      .from('report_shares')
      .select('id, group_id, expires_at')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(404).json({ error: 'This report link has expired.' });
    }

    // Fetch all report data in parallel (NO evaluation data for public reports)
    const [groupRes, membersRes, tasksRes, activityRes] = await Promise.all([
      adminClient
        .from('groups')
        .select('id, name, subject, due_date, lead_id, created_at')
        .eq('id', share.group_id)
        .single(),
      adminClient
        .from('group_members')
        .select('*, profile:profiles(id, name, university, faculty, year_of_study)')
        .eq('group_id', share.group_id)
        .order('joined_at', { ascending: true }),
      adminClient
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, name)')
        .eq('group_id', share.group_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      adminClient
        .from('activity_log')
        .select('*, actor:profiles!activity_log_actor_id_fkey(id, name)')
        .eq('group_id', share.group_id)
        .order('created_at', { ascending: true }),
    ]);

    if (groupRes.error || !groupRes.data) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Fetch evidence for all tasks
    const taskIds = (tasksRes.data ?? []).map((t: { id: string }) => t.id);
    let evidenceByTask: Record<string, unknown[]> = {};

    if (taskIds.length > 0) {
      const { data: evidenceData } = await adminClient
        .from('evidence')
        .select('id, task_id, type, content, version_number, created_at')
        .in('task_id', taskIds)
        .order('version_number', { ascending: true });

      if (evidenceData) {
        for (const ev of evidenceData) {
          const taskId = (ev as { task_id: string }).task_id;
          if (!evidenceByTask[taskId]) evidenceByTask[taskId] = [];
          evidenceByTask[taskId].push(ev);
        }
      }
    }

    return res.status(200).json({
      group: groupRes.data,
      members: membersRes.data ?? [],
      tasks: tasksRes.data ?? [],
      activity: activityRes.data ?? [],
      evidenceByTask,
      // No evaluationSummaries — intentionally excluded from public reports
    });
  } catch (err) {
    console.error('[report/lookup] error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
