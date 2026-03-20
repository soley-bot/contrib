import { useState } from 'react';
import ProgressBar from '@/components/progress-bar';
import type { Group, GroupMember } from '@/types';

interface CourseGroupRowProps {
  group: Group;
  taskTotal: number;
  taskDone: number;
  memberCount: number;
  members?: GroupMember[];
  inviteLink?: string;
  onDownloadPdf: () => void;
  downloading: boolean;
  onClick?: () => void;
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const yearSuffix = date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + yearSuffix;
}

export default function CourseGroupRow({ group, taskTotal, taskDone, memberCount, members, inviteLink, onDownloadPdf, downloading, onClick }: CourseGroupRowProps) {
  const [copied, setCopied] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = !!(group.due_date && new Date(group.due_date + 'T00:00:00') < today && taskDone < taskTotal);

  function handleCopy() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`bg-white border border-[#E7E5E4] rounded-[10px] p-4 ${onClick ? 'cursor-pointer hover:border-[#0E7490] hover:shadow-sm transition-all' : ''}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-[8px] bg-[#F0FDFA] text-[#0E7490] font-bold text-sm flex items-center justify-center flex-shrink-0">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[14px] font-semibold text-[#1C1917] truncate">{group.name}</p>
              {isOverdue && (
                <span className="flex-shrink-0 text-[10px] font-semibold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">Overdue</span>
              )}
            </div>
            <p className="text-[11px] text-[#A8A29E] mt-0.5">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {taskDone}/{taskTotal} tasks done
              {group.due_date && <> · Due {formatDueDate(group.due_date)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {inviteLink && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
            >
              {copied ? <span className="text-green-600">Copied!</span> : 'Copy link'}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDownloadPdf(); }}
            disabled={downloading}
            className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {downloading ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={taskDone} max={taskTotal} />
      </div>
      {members && members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 bg-[#F5F5F4] rounded-full px-2.5 py-1"
              title={m.profile?.name ?? ''}
            >
              <div className="w-5 h-5 rounded-full bg-[#FFF0EE] text-[#FF5841] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {(m.profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[11px] text-[#57534E] font-medium max-w-[80px] truncate">
                {m.profile?.name ?? 'Unknown'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
