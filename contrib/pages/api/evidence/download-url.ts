import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const SIGNED_URL_TTL_SECONDS = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`evidence-download:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return res.status(400).json({ error: 'Missing evidence id.' });

  const { data: evidence } = await adminClient
    .from('evidence')
    .select('id, task_id, file_path, tasks!inner(group_id)')
    .eq('id', id)
    .single();

  // Unify the "can't give you this file" responses so an unauthenticated probe
  // cannot distinguish between "does not exist" and "exists but not yours".
  // Once authorization succeeds, a 400 for "no file_path" is fine — the caller
  // can legitimately see that information.
  const notFound = () => res.status(404).json({ error: 'Evidence not found.' });

  if (!evidence) return notFound();

  const groupId = (evidence.tasks as unknown as { group_id: string }).group_id;

  // Authorize: group member OR course teacher.
  const { data: member } = await adminClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .single();

  let authorized = !!member;

  if (!authorized) {
    const { data: teacherOwned } = await adminClient
      .from('groups')
      .select('courses!inner(teacher_id)')
      .eq('id', groupId)
      .single();
    const teacherId = (teacherOwned?.courses as unknown as { teacher_id: string } | null)?.teacher_id;
    authorized = teacherId === user.id;
  }

  if (!authorized) return notFound();

  // Caller is authorized — they may now learn this record has no file.
  if (!evidence.file_path) return res.status(400).json({ error: 'This evidence has no uploaded file.' });

  const { data, error } = await adminClient.storage
    .from('evidence')
    .createSignedUrl(evidence.file_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    Sentry.captureMessage(`[evidence/download-url] sign: ${error?.message ?? 'no url'}`, { level: 'error' });
    return res.status(500).json({ error: 'Could not generate download link.' });
  }

  return res.status(200).json({ url: data.signedUrl });
}
