import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { reportShareSchema, reportLookupSchema } from '@/lib/validation';
import { generateInviteToken } from '@/lib/invite';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Helper: extract user from Supabase auth cookie via API request.
 */
async function getUser(req: NextApiRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anonKey, {
    global: { headers: { cookie: req.headers.cookie ?? '' } },
    auth: { flowType: 'pkce', autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { session } } = await client.auth.getSession();
  return session?.user ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = getClientIp(req.headers);

  // ── GET: fetch existing share for a group ──
  if (req.method === 'GET') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated.' });

    const parsed = reportShareSchema.safeParse({ group_id: req.query.group_id });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
    }

    // Verify user is a group member
    const { data: membership } = await adminClient
      .from('group_members')
      .select('id')
      .eq('group_id', parsed.data.group_id)
      .eq('profile_id', user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

    const { data: share } = await adminClient
      .from('report_shares')
      .select('id, group_id, token, created_by, created_at, expires_at')
      .eq('group_id', parsed.data.group_id)
      .single();

    return res.status(200).json({ share: share ?? null });
  }

  // ── POST: create share link ──
  if (req.method === 'POST') {
    if (!rateLimit(`report-share:${ip}`, 10, 60_000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated.' });

    const parsed = reportShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
    }
    const { group_id } = parsed.data;

    // Verify user is group lead
    const { data: group } = await adminClient
      .from('groups')
      .select('id, lead_id')
      .eq('id', group_id)
      .single();

    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (group.lead_id !== user.id) return res.status(403).json({ error: 'Only the group lead can share the report.' });

    // Check for existing share — return it instead of creating a duplicate
    const { data: existing } = await adminClient
      .from('report_shares')
      .select('id, token, created_at')
      .eq('group_id', group_id)
      .single();

    if (existing) {
      const protocol = req.headers['x-forwarded-proto'] ?? 'http';
      const host = req.headers.host ?? 'localhost:3000';
      return res.status(200).json({
        token: existing.token,
        url: `${protocol}://${host}/report/${existing.token}`,
        existing: true,
      });
    }

    // Create new share
    const token = generateInviteToken();
    const { error: insertError } = await adminClient
      .from('report_shares')
      .insert({ group_id, token, created_by: user.id });

    if (insertError) {
      console.error('[report/share] insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create share link.' });
    }

    const protocol = req.headers['x-forwarded-proto'] ?? 'http';
    const host = req.headers.host ?? 'localhost:3000';
    return res.status(201).json({
      token,
      url: `${protocol}://${host}/report/${token}`,
      existing: false,
    });
  }

  // ── DELETE: revoke share link ──
  if (req.method === 'DELETE') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated.' });

    const parsed = reportShareSchema.safeParse({ group_id: req.query.group_id });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
    }
    const { group_id } = parsed.data;

    // Verify user is group lead
    const { data: group } = await adminClient
      .from('groups')
      .select('id, lead_id')
      .eq('id', group_id)
      .single();

    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (group.lead_id !== user.id) return res.status(403).json({ error: 'Only the group lead can revoke the share link.' });

    const { error: deleteError } = await adminClient
      .from('report_shares')
      .delete()
      .eq('group_id', group_id);

    if (deleteError) {
      console.error('[report/share] delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to revoke share link.' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
