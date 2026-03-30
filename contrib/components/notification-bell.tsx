import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { IconBell } from './icons';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/types';

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

interface NotificationBellProps {
  userId: string | undefined;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  if (!userId) return null;
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  function handleNotificationClick(n: Notification) {
    markAsRead(n.id);
    if (n.group_id) {
      router.push(`/group/${n.group_id}`);
    }
    setShowDropdown(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowDropdown((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors rounded-md hover:bg-[#F1F5F9]"
        aria-label="Notifications"
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#DC2626] text-white rounded-full flex items-center justify-center" style={{ fontSize: '10px', lineHeight: 1 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {showDropdown && (
        <div
          className="absolute right-0 top-10 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-[100] overflow-hidden"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.10)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
            <span className="text-[13px] font-semibold text-[#0F172A]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-[12px] font-medium text-[#1A56E8] hover:text-[#1240C4] transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFF] transition-colors ${
                    !n.read_at ? 'bg-[#EBF0FF]' : 'bg-white'
                  }`}
                >
                  <p className="text-[13px] font-medium text-[#0F172A] leading-snug">{n.title}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{formatRelativeTime(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
