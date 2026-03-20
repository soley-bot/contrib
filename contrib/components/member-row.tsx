import type { GroupMember, Task } from '@/types';
import { IconTrash } from '@/components/icons';

interface MemberRowProps {
  member: GroupMember;
  tasks: Task[];
  isThisMemberLead: boolean;
  canRemove: boolean;
  onRemove?: () => void;
}

export default function MemberRow({ member, tasks, isThisMemberLead, canRemove, onRemove }: MemberRowProps) {
  const name = member.profile?.name ?? '—';
  const university = member.profile?.university ?? '';
  const initials = name.slice(0, 2).toUpperCase();
  const memberTasks = tasks.filter((t) => t.assignee_id === member.profile_id);
  const doneTasks = memberTasks.filter((t) => t.status === 'done');
  const pct = memberTasks.length > 0 ? Math.round((doneTasks.length / memberTasks.length) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#E7E5E4] last:border-none">
      <div className="w-9 h-9 rounded-full bg-brand-light text-brand text-[13px] font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-medium text-[#1C1917]">{name}</span>
          {isThisMemberLead && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-light text-brand">
              Lead
            </span>
          )}
        </div>
        <p className="text-xs text-[#A8A29E] mt-0.5 truncate">{university}</p>
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F5F4] text-[#57534E]">
            {memberTasks.length} tasks
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A]">
            {doneTasks.length} done
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-light text-brand">
            {pct}%
          </span>
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="p-2 text-[#A8A29E] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
          title="Remove member"
        >
          <IconTrash size={15} />
        </button>
      )}
    </div>
  );
}
