import { adminClient } from '@/lib/supabase-admin';
import { sendTelegramMessage } from '@/lib/telegram';

type NotificationType = 'contributions' | 'blockers' | 'deadlines' | 'weekly_digest';

const notifyColumnMap: Record<NotificationType, string> = {
  contributions: 'notify_contributions',
  blockers: 'notify_blockers',
  deadlines: 'notify_deadlines',
  weekly_digest: 'notify_weekly_digest',
};

/**
 * Send a Telegram notification to all group members who have a verified subscription
 * and have the relevant notification type enabled.
 * @param groupId - The group whose members should be notified
 * @param text - The message text to send
 * @param notificationType - Which notification preference to check
 * @param excludeProfileId - Skip notifying this user (usually the actor)
 */
export async function notifyGroupMembers(
  groupId: string,
  text: string,
  notificationType: NotificationType,
  excludeProfileId?: string,
): Promise<void> {
  const { data: members } = await adminClient
    .from('group_members')
    .select('profile_id')
    .eq('group_id', groupId);

  if (!members?.length) return;

  const profileIds = members
    .map((m: { profile_id: string }) => m.profile_id)
    .filter((id) => id !== excludeProfileId);

  if (!profileIds.length) return;

  const column = notifyColumnMap[notificationType];

  const { data: subs } = await adminClient
    .from('telegram_subscriptions')
    .select('chat_id, notify_contributions, notify_blockers, notify_deadlines, notify_weekly_digest')
    .in('profile_id', profileIds)
    .eq('verified', true)
    .eq(column, true);

  if (!subs?.length) return;

  await Promise.all(
    subs.map((s) => sendTelegramMessage(String(s.chat_id), text))
  );
}
