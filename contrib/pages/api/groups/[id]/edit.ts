import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validate, editGroupSchema } from '@/lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`group-edit:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Missing group ID.' });

  const { data: input, error: validationError } = validate(editGroupSchema, req.body);
  if (validationError || !input) return res.status(400).json({ error: validationError ?? 'Invalid request body.' });

  try {
    const { data: group } = await adminClient
      .from('groups')
      .select('id, lead_id, course_id, archived_at')
      .eq('id', groupId)
      .single();

    if (!group) return res.status(404).json({ error: 'Group not found.' });

    // Allow either the group lead OR the teacher who owns the course this group belongs to
    let authorized = group.lead_id === user.id;
    if (!authorized && group.course_id) {
      const { data: course } = await adminClient
        .from('courses')
        .select('teacher_id')
        .eq('id', group.course_id)
        .single();
      if (course?.teacher_id === user.id) authorized = true;
    }
    if (!authorized) return res.status(403).json({ error: 'Only the group lead or course teacher can edit this group.' });

    const { error: updateError } = await adminClient
      .from('groups')
      .update({
        name: input.name,
        subject: input.subject,
        due_date: input.dueDate || null,
      })
      .eq('id', groupId);

    if (updateError) {
      Sentry.captureMessage(`[groups/edit] update error: ${updateError.message}`, { level: 'error', tags: { route: 'groups/edit' } });
      return res.status(500).json({ error: 'Failed to update group.' });
    }

    // Log activity
    await adminClient.from('activity_log').insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'group_updated',
      task_id: null,
      meta: null,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({ error: 'Unexpected error.' });
  }
}
