import { IconCalendar } from '@/components/icons';
import type { Task } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done',
};
const STATUS_BADGE: Record<string, string> = {
  todo: 'bg-[#F5F5F4] text-[#57534E]',
  inprogress: 'bg-[#FEF3C7] text-[#D97706]',
  done: 'bg-[#DCFCE7] text-[#16A34A]',
};
const LEFT_BORDER: Record<string, string> = {
  todo: 'border-l-[#FFCFC9]',
  inprogress: 'border-l-[#D97706]',
  done: 'border-l-[#16A34A]',
};

interface TaskCardProps {
  task: Task;
  evidenceCount?: number;
  onClick: (task: Task) => void;
}

export default function TaskCard({ task, evidenceCount = 0, onClick }: TaskCardProps) {
  const initials = task.assignee?.name?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div
      onClick={() => onClick(task)}
      className={`bg-white border border-[#E7E5E4] border-l-4 ${LEFT_BORDER[task.status]} rounded-[10px] px-3.5 pt-3.5 pb-3.5 pl-[18px] mb-2.5 cursor-pointer active:shadow-md transition-shadow`}
    >
      <p className="text-[14px] font-medium text-[#1C1917] mb-2">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-5 h-5 rounded-full bg-[#FFF0EE] text-[#FF5841] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <span className="text-xs text-[#57534E]">{task.assignee?.name ?? '—'}</span>
        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-[#A8A29E]">
            <IconCalendar size={12} />
            {task.due_date}
          </span>
        )}
        {task.status === 'done' && (
          evidenceCount > 0
            ? <span className="text-[11px] font-medium text-[#16A34A]">📎 {evidenceCount} evidence</span>
            : <span className="text-[11px] text-[#A8A29E]">no evidence</span>
        )}
        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[task.status]}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </div>
    </div>
  );
}
