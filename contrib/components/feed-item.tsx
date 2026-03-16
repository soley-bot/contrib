import type { ActivityLog } from '@/types';

const ACTION_META: Record<string, { emoji: string; color: string; label: (meta: Record<string, unknown> | null) => string }> = {
  task_created:  { emoji: '📝', color: '#6366F1', label: (m) => `created task "${m?.task_title ?? ''}"` },
  task_assigned: { emoji: '👤', color: '#6366F1', label: (m) => `was assigned "${m?.task_title ?? ''}"` },
  task_done:     { emoji: '✅', color: '#16A34A', label: (m) => `completed "${m?.task_title ?? ''}"` },
  file_uploaded: { emoji: '📎', color: '#2563EB', label: (m) => `uploaded evidence for "${m?.task_title ?? ''}"` },
  member_joined: { emoji: '👋', color: '#6366F1', label: () => 'joined the group' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface FeedItemProps {
  entry: ActivityLog;
}

export default function FeedItem({ entry }: FeedItemProps) {
  const meta = ACTION_META[entry.action] ?? { emoji: '•', color: '#A8A29E', label: () => entry.action };
  const actorName = entry.actor?.name ?? 'Someone';

  return (
    <div className="flex items-start gap-2.5 py-3 border-b border-[#E7E5E4] last:border-none">
      <div
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm"
        style={{ background: `${meta.color}18` }}
      >
        {meta.emoji}
      </div>
      <div className="flex-1">
        <p className="text-[13px] text-[#1C1917] leading-snug">
          <span className="font-semibold">{actorName}</span>{' '}
          {meta.label(entry.meta as Record<string, unknown> | null)}
        </p>
        <p className="text-[11px] text-[#A8A29E] mt-0.5">{formatTime(entry.created_at)}</p>
      </div>
    </div>
  );
}
