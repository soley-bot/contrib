import { useState } from 'react';
import TaskCard from '@/components/task-card';
import TaskBoardSkeleton from '@/components/task-skeleton';
import GettingStartedChecklist from '@/components/getting-started-checklist';
import InlineTip from '@/components/inline-tip';
import { IconPlus, IconExport, IconList, IconActivity, IconCheck, IconLink, IconCopy } from '@/components/icons';
import type { Task, TaskStatus, GroupMember, EvaluationSummary } from '@/types';

const PDF_THEMES: { label: string; color: [number, number, number] }[] = [
  { label: 'Blue',   color: [26,  86,  232] },
  { label: 'Navy',   color: [30,  64,  175] },
  { label: 'Forest', color: [22,  101, 52]  },
  { label: 'Slate',  color: [71,  85,  105] },
  { label: 'Amber',  color: [180, 83,  9]   },
  { label: 'Plum',   color: [126, 34,  206] },
];

const STATUS_COLS: { status: TaskStatus; label: string; countClass: string; headerClass: string }[] = [
  { status: 'todo',       label: 'To Do',      countClass: 'bg-border text-text-secondary',  headerClass: 'bg-bg-hover text-text-secondary' },
  { status: 'inprogress', label: 'In Progress', countClass: 'bg-[#FDE68A] text-[#92400E]', headerClass: 'bg-[#FEF3C7] text-[#B45309]' },
  { status: 'done',       label: 'Done',        countClass: 'bg-[#BBF7D0] text-[#15803D]', headerClass: 'bg-[#DCFCE7] text-[#15803D]' },
];

type StatusFilter = 'all' | TaskStatus;

interface GroupTasksTabProps {
  tasks: Task[];
  members: GroupMember[];
  isLead: boolean;
  userId: string;
  groupId: string;
  tasksLoading: boolean;
  evalSession: boolean;
  evalSessionLoading: boolean;
  hasSubmitted: boolean;
  evalSummaries: EvaluationSummary[];
  evidenceByTask: Record<string, unknown[]>;
  pdfTheme: [number, number, number];
  setPdfTheme: (theme: [number, number, number]) => void;
  shareUrl: string | null;
  shareLoading: boolean;
  onShareLink: () => void;
  onRevokeShare: () => void;
  onCopyShareUrl: () => void;
  onExport: () => void;
  onOpenEvaluation: () => void;
  onSetTab: (tab: 'evaluation') => void;
  onSelectTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onNewTask: () => void;
}

export default function GroupTasksTab({
  tasks, members, isLead, userId, groupId, tasksLoading,
  evalSession, evalSessionLoading, hasSubmitted, evalSummaries, evidenceByTask,
  pdfTheme, setPdfTheme, shareUrl, shareLoading,
  onShareLink, onRevokeShare, onCopyShareUrl, onExport, onOpenEvaluation,
  onSetTab, onSelectTask, onEditTask, onDeleteTask, onNewTask,
}: GroupTasksTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
      {/* Peer review status banner */}
      {evalSession && !hasSubmitted && (
        <div className="bg-brand-light border border-brand-border rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-text">Peer Review is open — submit your ratings</p>
          <button onClick={() => onSetTab('evaluation')}
            className="flex-shrink-0 h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors">
            Go to Review
          </button>
        </div>
      )}
      {evalSession && hasSubmitted && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
          <IconCheck size={14} />
          <p className="text-sm text-[#15803D]">Peer Review submitted — {evalSummaries.length > 0 ? `${Math.max(...evalSummaries.map(s => s.eval_count))}/${members.length - 1} responded` : 'waiting for others'}</p>
        </div>
      )}

      {/* All-tasks-done evaluation nudge */}
      {!evalSessionLoading && !evalSession && tasks.length > 0 && tasks.every((t) => t.status === 'done') && (
        isLead ? (
          <div className="bg-brand-light border border-[#93B4FF] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-text">All tasks complete — ready for peer review?</p>
            <button onClick={onOpenEvaluation}
              className="flex-shrink-0 h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors">
              Open Peer Review
            </button>
          </div>
        ) : (
          <div className="bg-brand-light border border-[#93B4FF] rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <IconCheck size={14} />
            <p className="text-sm text-text">All tasks complete! Your group lead can open Peer Review when ready.</p>
          </div>
        )
      )}

      {/* Contribution Record — lead only */}
      {isLead && (
        <div className="bg-white border border-border rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text">Project Record</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">Share or download a portfolio-ready record of this project</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={onShareLink} disabled={shareLoading}
                className="h-8 px-3 border border-border bg-bg hover:bg-bg-hover text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60">
                <IconLink size={14} /> {shareLoading ? 'Sharing...' : 'Share Link'}
              </button>
              <button onClick={onExport}
                className="h-8 px-3 border border-border bg-bg hover:bg-bg-hover text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
                <IconExport size={14} /> Download PDF
              </button>
            </div>
          </div>
          {shareUrl && (
            <div className="mt-2.5 flex items-center gap-2 bg-bg border border-border rounded-md px-3 py-2">
              <p className="text-[12px] text-muted truncate flex-1">{shareUrl}</p>
              <button onClick={onCopyShareUrl}
                className="flex-shrink-0 p-1 text-muted hover:text-text transition-colors" title="Copy link">
                <IconCopy size={14} />
              </button>
              <button onClick={onRevokeShare}
                className="flex-shrink-0 text-[11px] text-red hover:text-[#B91C1C] font-medium transition-colors">
                Revoke
              </button>
            </div>
          )}
          <div className="flex gap-1.5 mt-2.5">
            {PDF_THEMES.map((t) => {
              const isActive = pdfTheme.join() === t.color.join();
              return (
                <button key={t.label} title={t.label} onClick={() => setPdfTheme(t.color)}
                  className={`w-5 h-5 rounded-full transition-all ${isActive ? 'ring-2 ring-offset-1 ring-text' : 'opacity-50 hover:opacity-100'}`}
                  style={{ backgroundColor: `rgb(${t.color.join(',')})` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Getting started checklist for lead */}
      {isLead && groupId && !tasksLoading && (
        <GettingStartedChecklist
          groupId={groupId}
          hasTasks={tasks.length > 0}
          hasTeammates={members.length > 1}
          hasEvidence={Object.values(evidenceByTask).some((arr) => arr.length > 0)}
        />
      )}

      <InlineTip id="tasks-log-work">Mark tasks as done and add work proof to build a stronger project record.</InlineTip>
      <InlineTip id="tasks-types">Tag tasks by type (research, meeting, coordination) to show the full picture of your project contribution.</InlineTip>

      {/* Task board skeleton while loading */}
      {tasksLoading ? <TaskBoardSkeleton /> : <>

      {/* Stats row */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
        {[
          { label: 'Total tasks', value: tasks.length,                                        color: '' },
          { label: 'Done',        value: tasks.filter(t => t.status === 'done').length,       color: '#16A34A' },
          { label: 'In progress', value: tasks.filter(t => t.status === 'inprogress').length, color: '#D97706' },
          { label: 'To do',       value: tasks.filter(t => t.status === 'todo').length,       color: '#94A3B8' },
        ].map((s) => (
          <div key={s.label} className="flex-shrink-0 bg-white border border-border rounded-xl px-3.5 py-2.5 min-w-[80px] shadow-sm">
            <p className="text-lg font-bold" style={{ color: s.color || '#0F172A' }}>{s.value}</p>
            <p className="text-[12px] text-text-tertiary mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mobile: status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto md:hidden" style={{ scrollbarWidth: 'none' }}>
        {(['all', 'todo', 'inprogress', 'done'] as StatusFilter[]).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
              statusFilter === s ? 'bg-brand-light text-brand border-brand-border' : 'bg-white text-text-secondary border-border'
            }`}
          >
            {{ all: `All (${tasks.length})`, todo: `To Do (${tasks.filter(t=>t.status==='todo').length})`, inprogress: `In Progress (${tasks.filter(t=>t.status==='inprogress').length})`, done: `Done (${tasks.filter(t=>t.status==='done').length})` }[s]}
          </button>
        ))}
      </div>

      {/* Mobile: flat list */}
      <div className="md:hidden">
        {tasks.length === 0
          ? <div className="text-center py-8">
              <p className="text-[15px] font-semibold text-text mb-1">No tasks yet</p>
              <p className="text-sm text-text-tertiary mb-4 max-w-xs mx-auto">Add your first task to start tracking contributions.{members.length < 2 ? ' Then invite teammates from the Members tab.' : ''}</p>
              <button onClick={onNewTask} className="inline-flex items-center gap-2 h-10 px-5 bg-brand hover:bg-brand-hover text-white text-[14px] font-medium rounded-md transition-colors">
                <IconPlus size={16} /> Add a task
              </button>
            </div>
          : filteredTasks.length === 0
          ? <p className="text-sm text-text-tertiary text-center py-8">No tasks here.</p>
          : filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} isLead={isLead} currentUserId={userId}
                evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                onClick={onSelectTask} onEdit={onEditTask} onDelete={onDeleteTask}
              />
            ))
        }
      </div>

      {/* Desktop: kanban */}
      <div className="hidden md:grid grid-cols-3 gap-4">
        {tasks.length === 0
          ? <div className="col-span-3 text-center py-8">
              <p className="text-[15px] font-semibold text-text mb-1">No tasks yet</p>
              <p className="text-sm text-text-tertiary mb-4 max-w-xs mx-auto">Add your first task to start tracking contributions.{members.length < 2 ? ' Then invite teammates from the Members tab.' : ''}</p>
              <button onClick={onNewTask} className="inline-flex items-center gap-2 h-10 px-5 bg-brand hover:bg-brand-hover text-white text-[14px] font-medium rounded-md transition-colors">
                <IconPlus size={16} /> Add a task
              </button>
            </div>
          : STATUS_COLS.map((col) => {
              const colTasks = tasks.filter(t => t.status === col.status);
              return (
                <div key={col.status}>
                  <div className={`flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-full w-fit ${col.headerClass}`}>
                    {col.status === 'todo'       && <IconList size={13} />}
                    {col.status === 'inprogress' && <IconActivity size={13} />}
                    {col.status === 'done'       && <IconCheck size={13} />}
                    <span className="text-[11px] font-bold uppercase tracking-wider">{col.label}</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${col.countClass}`}>{colTasks.length}</span>
                  </div>
                  {colTasks.length === 0 ? (
                    <div className="flex items-center justify-center py-8 border-2 border-dashed border-border rounded-xl">
                      <p className="text-[12px] text-[#C4C0BB]">No tasks here</p>
                    </div>
                  ) : colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} isLead={isLead} currentUserId={userId}
                      evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                      onClick={onSelectTask} onEdit={onEditTask} onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              );
            })
        }
      </div>
      </>}
    </div>
  );
}
