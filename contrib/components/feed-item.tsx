import React from 'react';
import type { ActivityLog } from '@/types';
import { IconPlus, IconUsers, IconCheck, IconPencil, IconTrash, IconRefresh, IconCrown, IconSettings, IconClip, IconBan, IconUserPlus } from '@/components/icons';

type IconComponent = ({ size }: { size?: number }) => React.ReactElement;

const ACTION_META: Record<string, { icon: IconComponent; color: string; label: (meta: Record<string, unknown> | null) => string }> = {
  task_created:         { icon: IconPlus,     color: 'var(--brand)', label: (m) => `created task "${m?.task_title ?? ''}"` },
  task_assigned:        { icon: IconUserPlus, color: 'var(--brand)', label: (m) => `was assigned "${m?.task_title ?? ''}"` },
  task_updated:         { icon: IconRefresh,  color: '#D97706', label: (m) => `updated task "${m?.task_title ?? ''}"` },
  task_done:            { icon: IconCheck,    color: '#16A34A', label: (m) => `completed "${m?.task_title ?? ''}"` },
  task_edited:          { icon: IconPencil,   color: '#D97706', label: (m) => `edited task "${m?.task_title ?? ''}"` },
  task_deleted:         { icon: IconTrash,    color: '#94A3B8', label: (m) => `deleted task "${m?.task_title ?? ''}"` },
  task_reassigned:      { icon: IconUserPlus, color: 'var(--brand)', label: (m) => `reassigned "${m?.task_title ?? ''}" to ${m?.to_name ?? ''}` },
  file_uploaded:        { icon: IconClip,     color: 'var(--brand)', label: (m) => `uploaded evidence for "${m?.task_title ?? ''}"` },
  evidence_added:       { icon: IconClip,     color: 'var(--brand)', label: (m) => `added evidence for "${m?.task_title ?? ''}"` },
  evidence_version_added: { icon: IconClip,   color: 'var(--brand)', label: (m) => `added new version of evidence for "${m?.task_title ?? ''}"` },
  member_joined:        { icon: IconUserPlus, color: 'var(--brand)', label: () => 'joined the group' },
  member_left:          { icon: IconUsers,    color: '#94A3B8', label: () => 'left the group' },
  member_removed:       { icon: IconBan,      color: '#94A3B8', label: (m) => `removed ${m?.removed_name ?? 'a member'} from the group` },
  group_updated:        { icon: IconSettings, color: '#475569', label: () => 'updated group details' },
  lead_transferred:     { icon: IconCrown,    color: 'var(--brand)', label: (m) => `transferred lead to ${m?.to_name ?? ''}` },
};

const DEFAULT_META = { icon: IconPlus, color: '#94A3B8' };

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
  const meta = ACTION_META[entry.action] ?? { ...DEFAULT_META, label: () => entry.action };
  const actorName = entry.actor?.name ?? 'Someone';
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-2.5 py-3 border-b border-border last:border-none">
      <div
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${meta.color}18`, color: meta.color }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1">
        <p className="text-[13px] text-text leading-snug">
          <span className="font-semibold">{actorName}</span>{' '}
          {meta.label(entry.meta as Record<string, unknown> | null)}
        </p>
        <p className="text-[11px] text-text-tertiary mt-0.5">{formatTime(entry.created_at)}</p>
      </div>
    </div>
  );
}
