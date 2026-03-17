import { IconCalendar, IconPencil, IconTrash } from '@/components/icons';
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
  isLead: boolean;
  currentUserId: string;
  evidenceCount?: number;
  onClick: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export default function TaskCard({ task, isLead, currentUserId, evidenceCount = 0, onClick, onEdit, onDelete }: TaskCardProps) {
  const initials = task.assignee?.name?.slice(0, 2).toUpperCase() ?? '??';
  const canEdit = isLead || task.assignee_id === currentUserId;

  return (
    <div
      onClick={() => onClick(task)}
      className={`group bg-white border border-[#E7E5E4] border-l-4 ${LEFT_BORDER[task.status]} rounded-[10px] px-3.5 pt-3.5 pb-3.5 pl-[18px] mb-2.5 cursor-pointer active:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-medium text-[#1C1917] mb-2 flex-1">{task.title}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="p-1.5 rounded-md text-[#A8A29E] hover:text-[#57534E] hover:bg-[#F5F5F4] transition-colors"
              title="Edit task"
            >
              <IconPencil size={13} />
            </button>
          )}
          {isLead && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task); }}
              className="p-1.5 rounded-md text-[#A8A29E] hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete task"
            >
              <IconTrash size={13} />
            </button>
          )}
        </div>
      </div>
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
            ? <span className="text-[11px] font-medium text-[#16A34A]">evidence ({evidenceCount})</span>
            : <span className="text-[11px] text-[#A8A29E]">no evidence</span>
        )}
        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[task.status]}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </div>
    </div>
  );
}
