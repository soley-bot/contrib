import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { reportShareSchema, reportLookupSchema } from '@/lib/validation';
import { generateInviteToken } from '@/lib/invite';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = getClientIp(req.headers);

  if (!rateLimit(`report-share:${ip}`, RATE_LIMITS.REPORT_SHARE.limit, RATE_LIMITS.REPORT_SHARE.window)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  // ── GET: fetch existing share for a group ──
  if (req.method === 'GET') {
    const user = await getUserFromApiRoute(req, res);
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
    const user = await getUserFromApiRoute(req, res);
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
      return res.status(200).json({
        token: existing.token,
        url: `${baseUrl}/report/${existing.token}`,
        existing: true,
      });
    }

    // Create new share
    const token = generateInviteToken();
    const { error: insertError } = await adminClient
      .from('report_shares')
      .insert({ group_id, token, created_by: user.id });

    if (insertError) {
      // Handle duplicate key (race condition: concurrent POSTs)
      if (insertError.code === '23505') {
        const { data: existing2 } = await adminClient.from('report_shares').select('token').eq('group_id', group_id).single();
        if (existing2) {
          const baseUrl2 = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
          return res.status(200).json({ token: existing2.token, url: `${baseUrl2}/report/${existing2.token}`, existing: true });
        }
      }
      Sentry.captureMessage(`[report/share] insert error: ${insertError.message}`, { level: 'error', tags: { route: 'report/share' } });
      return res.status(500).json({ error: 'Failed to create share link.' });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joincontrib.com';
    return res.status(201).json({
      token,
      url: `${baseUrl}/report/${token}`,
      existing: false,
    });
  }

  // ── DELETE: revoke share link ──
  if (req.method === 'DELETE') {
    const user = await getUserFromApiRoute(req, res);
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
      Sentry.captureMessage(`[report/share] delete error: ${deleteError.message}`, { level: 'error', tags: { route: 'report/share' } });
      return res.status(500).json({ error: 'Failed to revoke share link.' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
