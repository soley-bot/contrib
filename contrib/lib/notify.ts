import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Send a Telegram notification to all group members who have a verified subscription.
 * @param groupId - The group whose members should be notified
 * @param text - The message text to send
 * @param excludeProfileId - Skip notifying this user (usually the actor)
 */
export async function notifyGroupMembers(
  groupId: string,
  text: string,
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

  const { data: subs } = await adminClient
    .from('telegram_subscriptions')
    .select('chat_id')
    .in('profile_id', profileIds)
    .eq('verified', true);

  if (!subs?.length) return;

  await Promise.all(
    subs.map((s: { chat_id: string }) => sendTelegramMessage(s.chat_id, text))
  );
}
