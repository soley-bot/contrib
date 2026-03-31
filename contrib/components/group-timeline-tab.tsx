import FeedItem from '@/components/feed-item';
import InlineTip from '@/components/inline-tip';
import type { ActivityLog } from '@/types';

interface GroupTimelineTabProps {
  activity: ActivityLog[];
  onShowBlockerModal: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

export default function GroupTimelineTab({ activity, onShowBlockerModal, onLoadMore, hasMore, loadingMore }: GroupTimelineTabProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
      <InlineTip id="timeline-blocker">Use the &quot;Heads Up&quot; button to flag blockers. Your team and teacher will see it here in the Timeline.</InlineTip>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Recent activity</p>
        <button
          onClick={onShowBlockerModal}
          className="h-7 px-3 border border-border bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[12px] font-medium text-muted hover:text-[#DC2626] rounded-md flex items-center gap-1.5 transition-colors"
        >
          Heads Up
        </button>
      </div>
      {activity.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <svg viewBox="0 0 120 90" fill="none" className="w-28 mx-auto mb-4 opacity-80">
            <ellipse cx="60" cy="82" rx="44" ry="6" fill="#F1F5F9"/>
            <circle cx="60" cy="42" r="28" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2"/>
            <circle cx="60" cy="42" r="22" fill="white"/>
            <line x1="60" y1="42" x2="60" y2="26" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="60" y1="42" x2="70" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="60" cy="42" r="2.5" fill="#94A3B8"/>
            <line x1="60" y1="22" x2="60" y2="25" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="60" y1="59" x2="60" y2="62" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="40" y1="42" x2="43" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="77" y1="42" x2="80" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-[14px] font-semibold text-text-secondary mb-1">No activity yet</p>
          <p className="text-sm text-text-tertiary">Actions will appear here as your team works.</p>
        </div>
      ) : (
        <>
          {activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="h-9 px-5 border border-border bg-white hover:bg-bg-hover text-[13px] font-medium text-text-secondary rounded-md transition-colors disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
