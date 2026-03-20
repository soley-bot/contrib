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
}

export default function CourseGroupRow({ group, taskTotal, taskDone, memberCount, members, inviteLink, onDownloadPdf, downloading }: CourseGroupRowProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[10px] p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-[8px] bg-brand-light text-brand font-bold text-sm flex items-center justify-center flex-shrink-0">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1C1917] truncate">{group.name}</p>
            <p className="text-[11px] text-[#A8A29E] mt-0.5">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {taskDone}/{taskTotal} tasks done
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {inviteLink && (
            <button
              onClick={handleCopy}
              className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
            >
              {copied ? <span className="text-green-600">Copied!</span> : 'Copy link'}
            </button>
          )}
          <button
            onClick={onDownloadPdf}
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
