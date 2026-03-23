import { IconCalendar, IconPencil, IconTrash } from '@/components/icons';
import type { Task } from '@/types';

function dueDateClass(dueDate: string | null | undefined): string {
  if (!dueDate) return 'text-[#94A3B8]';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (dueDate < today) return 'text-red-500 font-semibold';
  if (dueDate <= tomorrow) return 'text-amber-500 font-medium';
  return 'text-[#94A3B8]';
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done',
};
const STATUS_BADGE: Record<string, string> = {
  todo: 'bg-[#F1F5F9] text-[#475569]',
  inprogress: 'bg-[#FEF3C7] text-[#D97706]',
  done: 'bg-[#DCFCE7] text-[#16A34A]',
};
const LEFT_BORDER: Record<string, string> = {
  todo: 'border-l-brand-border',
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
  const isDone = task.status === 'done';
  const cardBg = isDone ? 'bg-[#F0FDF4]' : 'bg-white';

  return (
    <div
      onClick={() => onClick(task)}
      className={`group ${cardBg} border border-[#E2E8F0] border-l-4 ${LEFT_BORDER[task.status]} rounded-xl px-3.5 pt-3.5 pb-3.5 pl-[18px] mb-2.5 cursor-pointer active:shadow-md transition-all`}
      style={isDone ? { animation: 'done-flash 0.6s ease-out forwards' } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-medium text-[#0F172A] mb-2 flex-1">{task.title}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors"
              title="Edit task"
            >
              <IconPencil size={13} />
            </button>
          )}
          {isLead && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task); }}
              className="p-1.5 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete task"
            >
              <IconTrash size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-5 h-5 rounded-full bg-brand-light text-brand text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <span className="text-xs text-[#475569]">{task.assignee?.name ?? '—'}</span>
        {task.due_date && (
          <span className={`flex items-center gap-1 text-xs ${dueDateClass(task.due_date)}`}>
            <IconCalendar size={12} />
            {task.due_date}
          </span>
        )}
        {task.status === 'done' && (
          evidenceCount > 0
            ? <span className="text-[11px] font-medium text-[#16A34A]">evidence ({evidenceCount})</span>
            : <span className="text-[11px] text-[#94A3B8]">no evidence</span>
        )}
        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[task.status]}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </div>
    </div>
  );
}
