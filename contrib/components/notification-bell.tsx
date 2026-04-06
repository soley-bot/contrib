import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { IconBell } from './icons';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification, NotificationType } from '@/types';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  const cls = "flex-shrink-0 text-[#94A3B8]";
  switch (type) {
    case 'task_assigned':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 6h4M6 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      );
    case 'task_reassigned':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4-3v6L4 6zM12 10l-4 3V7l4 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      );
    case 'evaluation_opened':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      );
    case 'member_joined':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M2.5 13c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    case 'evidence_added':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'blocker_declared':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M8 6.5v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    case 'deadline_approaching':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'weekly_digest':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    case 'task_comment':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5H6l-3 2.5V12H3.5A1.5 1.5 0 012 10.5v-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
    case 'group_created_in_course':
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="5.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.4"/>
          <circle cx="10.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M2 13c0-2 1.5-3.5 3.5-3.5S9 11 9 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M12 9.5h2.5M13.25 8.25v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    default:
      return null;
  }
}

function getDateGroup(dateStr: string): 'today' | 'yesterday' | 'earlier' {
  const now = new Date();
  const date = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const t = date.getTime();
  if (t >= todayStart) return 'today';
  if (t >= yesterdayStart) return 'yesterday';
  return 'earlier';
}

const DATE_GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

interface NotificationBellProps {
  userId: string | undefined;
  sidebar?: boolean;
}

export default function NotificationBell({ userId, sidebar }: NotificationBellProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId ?? '');

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  // Close dropdown when profile menu opens (listen for clicks outside)
  useEffect(() => {
    if (!showDropdown) return;
    function handleFocusOut() {
      // Close if another z-200 menu opens
      setTimeout(() => {
        if (ref.current && !ref.current.contains(document.activeElement)) {
          setShowDropdown(false);
        }
      }, 0);
    }
    ref.current?.addEventListener('focusout', handleFocusOut);
    return () => ref.current?.removeEventListener('focusout', handleFocusOut);
  }, [showDropdown]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: Notification[] }[] = [];
    const order = ['today', 'yesterday', 'earlier'] as const;
    const buckets: Record<string, Notification[]> = { today: [], yesterday: [], earlier: [] };
    for (const n of notifications) {
      buckets[getDateGroup(n.created_at)].push(n);
    }
    for (const key of order) {
      if (buckets[key].length > 0) {
        groups.push({ key, label: DATE_GROUP_LABELS[key], items: buckets[key] });
      }
    }
    return groups;
  }, [notifications]);

  if (!userId) return null;

  function handleNotificationClick(n: Notification) {
    markAsRead(n.id);
    // Teacher-facing notification: route to the teacher drill-down, not the
    // student group page (which teachers cannot access).
    if (n.type === 'group_created_in_course' && n.group_id) {
      const courseId = typeof n.meta?.courseId === 'string' ? n.meta.courseId : null;
      if (courseId) {
        router.push(`/teacher/course/${courseId}/group/${n.group_id}`);
        setShowDropdown(false);
        return;
      }
    }
    if (n.group_id) {
      router.push(`/group/${n.group_id}`);
    }
    setShowDropdown(false);
  }

  const emptyState = (
    <div className="px-4 py-8 text-center">
      <svg className="mx-auto mb-2 text-border" width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6.667a5 5 0 00-10 0c0 5.833-2.5 7.5-2.5 7.5h15S15 12.5 15 6.667z" />
        <path d="M11.442 16.667a1.667 1.667 0 01-2.884 0" />
        <path d="M6 8l3 3 5-5" strokeWidth="1.5" />
      </svg>
      <p className="text-[13px] text-text-tertiary">You&apos;re all caught up</p>
    </div>
  );

  const dropdownContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[13px] font-semibold text-text">Notifications</span>
        {unreadCount > 0 && (
          <button onClick={() => markAllAsRead()} className="text-[12px] font-medium text-brand hover:text-brand-dark transition-colors">
            Mark all as read
          </button>
        )}
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? emptyState : (
          grouped.map((group) => (
            <div key={group.key}>
              <div className="px-4 py-1.5 bg-bg border-b border-bg-hover">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{group.label}</span>
              </div>
              {group.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-bg-hover hover:bg-bg transition-colors ${
                    !n.read_at ? 'bg-brand-light' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {!n.read_at && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                      )}
                      <NotificationTypeIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text leading-snug">{n.title}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">
                        {n.meta?.groupName ? (
                          <><span className="text-muted">{String(n.meta.groupName)}</span> &middot; </>
                        ) : null}
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );

  if (sidebar) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setShowDropdown((o) => !o)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium text-muted hover:bg-brand-light transition-colors"
          aria-label="Notifications"
        >
          <span className="relative flex-shrink-0">
            <IconBell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#DC2626] text-white rounded-full flex items-center justify-center text-[9px] leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          Notifications
        </button>
        {showDropdown && (
          <div
            className="absolute left-full top-0 ml-1 w-80 bg-white border border-border rounded-xl shadow-dropdown z-[200] overflow-hidden"
          >
            {dropdownContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowDropdown((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center text-muted hover:text-text transition-colors rounded-md hover:bg-bg-hover"
        aria-label="Notifications"
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#DC2626] text-white rounded-full flex items-center justify-center text-[10px] leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {showDropdown && (
        <div
          className="absolute right-0 top-10 w-[calc(100vw-2rem)] max-w-80 bg-white border border-border rounded-xl shadow-dropdown z-[200] overflow-hidden"
        >
          {dropdownContent}
        </div>
      )}
    </div>
  );
}
