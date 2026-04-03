import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { getUserFromApiRoute } from '@/lib/supabase-server';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { notifyGroupMembers } from '@/lib/notify';

/**
 * POST /api/groups/[id]/join
 * Server-side group join. Replaces client-side multi-step join in pages/join/[token].tsx.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req.headers);
  if (!(await rateLimit(`join-group:${ip}`, RATE_LIMITS.DEFAULT.limit, RATE_LIMITS.DEFAULT.window))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const user = await getUserFromApiRoute(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const groupId = req.query.id;
  if (typeof groupId !== 'string') return res.status(400).json({ error: 'Invalid group ID.' });

  try {
    // Fetch the group
    const { data: group, error: groupError } = await adminClient
      .from('groups')
      .select('id, name, lead_id, course_id, archived_at')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Cannot join an archived group
    if (group.archived_at) {
      return res.status(410).json({ error: 'This group has been archived.' });
    }

    // Fetch caller's profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Teachers cannot join student groups
    if (profile.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot join student groups.' });
    }

    // Check if already a member
    const { data: existingMember } = await adminClient
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existingMember) {
      return res.status(409).json({ error: 'Already a member.' });
    }

    // One-group-per-course check
    if (group.course_id) {
      const { data: courseGroups } = await adminClient
        .from('groups')
        .select('id')
        .eq('course_id', group.course_id);

      const courseGroupIds = (courseGroups ?? []).map((g: { id: string }) => g.id);

      if (courseGroupIds.length > 0) {
        const { data: existing } = await adminClient
          .from('group_members')
          .select('id')
          .in('group_id', courseGroupIds)
          .eq('profile_id', user.id)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({ error: 'You are already in a group for this course.' });
        }
      }
    }

    // Check group is not full (max 6 members)
    const { count, error: countError } = await adminClient
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (countError) {
      Sentry.captureMessage(`[join] count error: ${countError.message}`, {
        level: 'error',
        tags: { route: 'join-group' },
      });
      return res.status(500).json({ error: 'Failed to check group capacity.' });
    }

    if ((count ?? 0) >= 6) {
      return res.status(400).json({ error: 'Group is full.' });
    }

    // Insert group membership
    const { error: insertError } = await adminClient
      .from('group_members')
      .insert({ group_id: groupId, profile_id: user.id });

    if (insertError) {
      Sentry.captureMessage(`[join] insert member error: ${insertError.message}`, {
        level: 'error',
        tags: { route: 'join-group' },
      });
      return res.status(500).json({ error: 'Failed to join group.' });
    }

    // Log activity
    await adminClient.from('activity_log').insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'member_joined',
      meta: {},
    });

    const callerName = profile.name ?? 'A new member';

    // Auto-transfer lead from teacher to first student joining
    const { data: leadProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', group.lead_id)
      .single();

    if (leadProfile?.role === 'teacher') {
      await adminClient
        .from('groups')
        .update({ lead_id: user.id })
        .eq('id', groupId);

      await adminClient.from('activity_log').insert({
        group_id: groupId,
        actor_id: user.id,
        action: 'lead_transferred',
        meta: { newLeadName: callerName },
      });

      await adminClient.from('notifications').insert({
        recipient_id: user.id,
        group_id: groupId,
        type: 'lead_transferred',
        title: 'You are now the group lead',
        meta: { groupName: group.name },
      });
    } else {
      // Notify the group lead (skip if teacher — they just lost lead status)
      await adminClient.from('notifications').insert({
        recipient_id: group.lead_id,
        group_id: groupId,
        type: 'member_joined',
        title: callerName + ' joined your group',
        meta: { memberName: callerName, groupName: group.name },
      });
    }

    // If group has a course, upsert course membership
    if (group.course_id) {
      await adminClient
        .from('course_members')
        .upsert(
          { course_id: group.course_id, profile_id: user.id },
          { onConflict: 'course_id,profile_id' }
        );
    }

    // Telegram notification (fire-and-forget)
    notifyGroupMembers(
      groupId,
      'A new member joined ' + group.name + '!',
      'contributions',
      user.id
    ).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'join-group' } });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
