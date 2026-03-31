import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { notifyGroupMembers } from '@/lib/notify';

/** Placeholder — implemented in Task 3 */
async function sendTeacherDigest(): Promise<number> {
  return 0;
}

/** Returns YYYY-MM-DD for "tomorrow" in ICT (UTC+7) */
function getTomorrowICT(): string {
  const now = new Date();
  // Advance to ICT then add one day
  const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const tomorrow = new Date(ictNow);
  tomorrow.setUTCDate(ictNow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/** Returns the ICT day of week (0 = Sunday, 1 = Monday, …) */
function getICTDayOfWeek(): number {
  const now = new Date();
  const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ictNow.getUTCDay();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  // Verify cron secret
  const authHeader = req.headers['authorization'];
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tomorrow = getTomorrowICT();
  let deadlineCount = 0;

  // ── Task-level reminders ────────────────────────────────────────────────────
  const { data: tasks, error: tasksError } = await adminClient
    .from('tasks')
    .select('id, title, group_id, groups(name)')
    .eq('due_date', tomorrow)
    .neq('status', 'done')
    .is('deleted_at', null);

  if (tasksError) {
    Sentry.captureMessage(`[cron/daily] tasks query error: ${tasksError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily' },
    });
  } else if (tasks?.length) {
    for (const task of tasks) {
      const groupsRel = task.groups as unknown as { name: string } | { name: string }[] | null;
      const groupName = (Array.isArray(groupsRel) ? groupsRel[0]?.name : groupsRel?.name) ?? 'your group';

      // In-app notification
      const { error: notifError } = await adminClient.from('notifications').insert({
        recipient_id: null, // populated per-member via group membership in notifyGroupMembers
        group_id: task.group_id,
        type: 'deadline_approaching' as const,
        title: 'Task due tomorrow',
        body: `"${task.title}" in ${groupName} is due tomorrow.`,
        meta: { task_id: task.id },
      });

      if (notifError) {
        Sentry.captureMessage(`[cron/daily] notification insert error: ${notifError.message}`, {
          level: 'error',
          tags: { route: 'cron/daily', task_id: task.id },
        });
      }

      // Telegram notification
      await notifyGroupMembers(
        task.group_id,
        `Reminder: "${task.title}" in ${groupName} is due tomorrow.`,
        'deadlines',
      );

      deadlineCount += 1;
    }
  }

  // ── Group-level reminders ───────────────────────────────────────────────────
  const { data: groups, error: groupsError } = await adminClient
    .from('groups')
    .select('id, name')
    .eq('due_date', tomorrow);

  if (groupsError) {
    Sentry.captureMessage(`[cron/daily] groups query error: ${groupsError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily' },
    });
  } else if (groups?.length) {
    for (const group of groups) {
      // Get all group members
      const { data: members, error: membersError } = await adminClient
        .from('group_members')
        .select('profile_id')
        .eq('group_id', group.id);

      if (membersError) {
        Sentry.captureMessage(`[cron/daily] group_members query error: ${membersError.message}`, {
          level: 'error',
          tags: { route: 'cron/daily', group_id: group.id },
        });
        continue;
      }

      if (members?.length) {
        // Insert in-app notification for each member
        const notifRows = members.map((m: { profile_id: string }) => ({
          recipient_id: m.profile_id,
          group_id: group.id,
          type: 'deadline_approaching' as const,
          title: 'Group due tomorrow',
          body: `Your group "${group.name}" project is due tomorrow.`,
          meta: { group_id: group.id },
        }));

        const { error: groupNotifError } = await adminClient
          .from('notifications')
          .insert(notifRows);

        if (groupNotifError) {
          Sentry.captureMessage(
            `[cron/daily] group notification insert error: ${groupNotifError.message}`,
            {
              level: 'error',
              tags: { route: 'cron/daily', group_id: group.id },
            },
          );
        }
      }

      // Telegram notification
      await notifyGroupMembers(
        group.id,
        `Reminder: your group "${group.name}" project is due tomorrow.`,
        'deadlines',
      );

      deadlineCount += 1;
    }
  }

  // ── Teacher digest (Mondays only) ───────────────────────────────────────────
  let digestCount = 0;
  if (getICTDayOfWeek() === 1) {
    digestCount = await sendTeacherDigest();
  }

  // Respond LAST — never res.end() before async work completes
  return res.status(200).json({ ok: true, deadlines: deadlineCount, digest: digestCount });
}
