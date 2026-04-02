import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { adminClient } from '@/lib/supabase-admin';
import { notifyGroupMembers } from '@/lib/notify';
import { sendTelegramMessage } from '@/lib/telegram';

async function sendTeacherDigest(): Promise<number> {
  let digestsSent = 0;

  // 1. Fetch all teachers
  const { data: teachers, error: teachersError } = await adminClient
    .from('profiles')
    .select('id, name')
    .eq('role', 'teacher');

  if (teachersError) {
    Sentry.captureMessage(`[cron/daily] sendTeacherDigest teachers query error: ${teachersError.message}`, {
      level: 'error',
      tags: { route: 'cron/daily' },
    });
    return 0;
  }

  if (!teachers?.length) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const teacher of teachers) {
    // 2. Fetch courses for this teacher
    const { data: courses, error: coursesError } = await adminClient
      .from('courses')
      .select('id, name')
      .eq('teacher_id', teacher.id);

    if (coursesError) {
      Sentry.captureMessage(`[cron/daily] sendTeacherDigest courses query error: ${coursesError.message}`, {
        level: 'error',
        tags: { route: 'cron/daily', teacher_id: teacher.id },
      });
      continue;
    }

    if (!courses?.length) continue;

    for (const course of courses) {
      // 3. Fetch groups for this course
      const { data: groups, error: groupsError } = await adminClient
        .from('groups')
        .select('id, name, due_date')
        .eq('course_id', course.id);

      if (groupsError) {
        Sentry.captureMessage(`[cron/daily] sendTeacherDigest groups query error: ${groupsError.message}`, {
          level: 'error',
          tags: { route: 'cron/daily', course_id: course.id },
        });
        continue;
      }

      const groupList = groups ?? [];
      const groupIds = groupList.map((g) => g.id);

      // 4a. Count total students across all groups
      let totalStudents = 0;
      if (groupIds.length > 0) {
        const { count: memberCount, error: memberError } = await adminClient
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .in('group_id', groupIds);

        if (memberError) {
          Sentry.captureMessage(`[cron/daily] sendTeacherDigest group_members count error: ${memberError.message}`, {
            level: 'error',
            tags: { route: 'cron/daily', course_id: course.id },
          });
        } else {
          totalStudents = memberCount ?? 0;
        }
      }

      // 4b. Task completion percentage
      let completionPct = 0;
      if (groupIds.length > 0) {
        const { data: allTasks, error: allTasksError } = await adminClient
          .from('tasks')
          .select('id, status')
          .in('group_id', groupIds)
          .is('deleted_at', null);

        if (allTasksError) {
          Sentry.captureMessage(`[cron/daily] sendTeacherDigest tasks query error: ${allTasksError.message}`, {
            level: 'error',
            tags: { route: 'cron/daily', course_id: course.id },
          });
        } else if (allTasks?.length) {
          const doneTasks = allTasks.filter((t) => t.status === 'done').length;
          completionPct = Math.round((doneTasks / allTasks.length) * 100);
        }
      }

      // 4c. Overdue groups: due_date < today AND still have incomplete tasks
      let overdueCount = 0;
      if (groupIds.length > 0) {
        const overdueGroupIds = groupList
          .filter((g) => g.due_date && g.due_date < todayStr)
          .map((g) => g.id);

        if (overdueGroupIds.length > 0) {
          const { data: incompleteTasks, error: incompleteError } = await adminClient
            .from('tasks')
            .select('group_id')
            .in('group_id', overdueGroupIds)
            .neq('status', 'done')
            .is('deleted_at', null);

          if (incompleteError) {
            Sentry.captureMessage(`[cron/daily] sendTeacherDigest overdue tasks query error: ${incompleteError.message}`, {
              level: 'error',
              tags: { route: 'cron/daily', course_id: course.id },
            });
          } else {
            const groupsWithIncomplete = new Set((incompleteTasks ?? []).map((t) => t.group_id));
            overdueCount = groupsWithIncomplete.size;
          }
        }
      }

      // 4d. Unresolved blockers
      let blockerCount = 0;
      if (groupIds.length > 0) {
        const { count: bCount, error: blockerError } = await adminClient
          .from('blocker_declarations')
          .select('id', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .gte('created_at', sevenDaysAgo);

        if (blockerError) {
          Sentry.captureMessage(`[cron/daily] sendTeacherDigest blockers query error: ${blockerError.message}`, {
            level: 'error',
            tags: { route: 'cron/daily', course_id: course.id },
          });
        } else {
          blockerCount = bCount ?? 0;
        }
      }

      // 4e. Inactive groups: no activity_log entry in 7+ days
      let inactiveCount = 0;
      if (groupIds.length > 0) {
        const { data: recentActivity, error: activityError } = await adminClient
          .from('activity_log')
          .select('group_id')
          .in('group_id', groupIds)
          .gte('created_at', sevenDaysAgo);

        if (activityError) {
          Sentry.captureMessage(`[cron/daily] sendTeacherDigest activity_log query error: ${activityError.message}`, {
            level: 'error',
            tags: { route: 'cron/daily', course_id: course.id },
          });
        } else {
          const activeGroupIds = new Set((recentActivity ?? []).map((a) => a.group_id));
          inactiveCount = groupIds.filter((id) => !activeGroupIds.has(id)).length;
        }
      }

      // 5. Build message
      const lines: string[] = [
        `Weekly Digest -- ${course.name}`,
        '',
        `Groups: ${groupList.length} (${totalStudents} students)`,
        `Completion: ${completionPct}%`,
      ];
      if (overdueCount > 0) lines.push(`Overdue: ${overdueCount} groups`);
      if (blockerCount > 0) lines.push(`Blockers: ${blockerCount} unresolved`);
      if (inactiveCount > 0) lines.push(`Inactive: ${inactiveCount} groups (7+ days)`);
      lines.push('');
      lines.push('View details at joincontrib.com/teacher');

      const message = lines.join('\n');

      // 6. Send via Telegram if teacher has a verified subscription with weekly digest enabled
      const { data: subscription, error: subError } = await adminClient
        .from('telegram_subscriptions')
        .select('chat_id')
        .eq('profile_id', teacher.id)
        .eq('verified', true)
        .eq('notify_weekly_digest', true)
        .maybeSingle();

      if (subError) {
        Sentry.captureMessage(`[cron/daily] sendTeacherDigest subscription query error: ${subError.message}`, {
          level: 'error',
          tags: { route: 'cron/daily', teacher_id: teacher.id },
        });
      } else if (subscription?.chat_id) {
        await sendTelegramMessage(String(subscription.chat_id), message);
      }

      // 7. Insert in-app notification
      const { error: notifError } = await adminClient.from('notifications').insert({
        recipient_id: teacher.id,
        group_id: null,
        type: 'weekly_digest',
        title: `Weekly Digest -- ${course.name}`,
        meta: { courseId: course.id, courseName: course.name },
      });

      if (notifError) {
        Sentry.captureMessage(`[cron/daily] sendTeacherDigest notification insert error: ${notifError.message}`, {
          level: 'error',
          tags: { route: 'cron/daily', teacher_id: teacher.id, course_id: course.id },
        });
      }

      digestsSent += 1;
    }
  }

  return digestsSent;
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
    .select('id, title, assignee_id, group_id, groups(name)')
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

      // In-app notification for the task assignee
      const assigneeId = (task as unknown as { assignee_id: string | null }).assignee_id;

      if (assigneeId) {
        const { error: notifError } = await adminClient.from('notifications').insert({
          recipient_id: assigneeId,
          group_id: task.group_id,
          type: 'deadline_approaching' as const,
          title: `Task "${task.title}" in ${groupName} is due tomorrow`,
          meta: { taskId: task.id, groupName },
        });

        if (notifError) {
          Sentry.captureMessage(`[cron/daily] notification insert error: ${notifError.message}`, {
            level: 'error',
            tags: { route: 'cron/daily', task_id: task.id },
          });
        }
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
          title: `Your group "${group.name}" is due tomorrow`,
          meta: { groupName: group.name },
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
