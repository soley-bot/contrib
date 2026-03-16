import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import type { Task, GroupMember, TaskStatus } from '@/types';

interface TaskModalProps {
  task: Task;
  members: GroupMember[];
  userId: string;
  isLead: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'inprogress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

export default function TaskModal({ task, members, userId, isLead, onClose, onUpdated }: TaskModalProps) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [evidenceUrl, setEvidenceUrl] = useState(task.evidence_url ?? '');
  const [saving, setSaving] = useState(false);

  const canChangeStatus = isLead || task.assignee_id === userId;

  async function handleSave() {
    if (status === task.status && evidenceUrl === (task.evidence_url ?? '')) {
      onClose();
      return;
    }
    setSaving(true);
    const updates: Partial<Task> = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    if (evidenceUrl.trim()) updates.evidence_url = evidenceUrl.trim();

    await supabase.from('tasks').update(updates).eq('id', task.id);

    if (status !== task.status) {
      const action = status === 'done' ? 'task_done' : 'task_assigned';
      await supabase.from('activity_log').insert({
        group_id: task.group_id,
        actor_id: userId,
        action,
        task_id: task.id,
        meta: { task_title: task.title },
      });
    }

    if (evidenceUrl.trim() && evidenceUrl !== task.evidence_url) {
      await supabase.from('activity_log').insert({
        group_id: task.group_id,
        actor_id: userId,
        action: 'file_uploaded',
        task_id: task.id,
        meta: { task_title: task.title },
      });
    }

    setSaving(false);
    onUpdated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px] max-h-[90dvh] overflow-y-auto"
        style={{ animation: 'slideUp .25s ease' }}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
          <h2 className="text-base font-semibold text-[#1C1917] truncate">{task.title}</h2>
          <button onClick={onClose} className="text-[#57534E] hover:text-[#1C1917] ml-2 p-1">
            <IconClose size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {task.description && (
            <div>
              <p className="text-[13px] font-medium text-[#57534E] mb-1">Description</p>
              <p className="text-sm text-[#1C1917]">{task.description}</p>
            </div>
          )}

          <div>
            <p className="text-[13px] font-medium text-[#57534E] mb-2">Assignee</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#EEF2FF] text-[#6366F1] text-[11px] font-bold flex items-center justify-center">
                {task.assignee?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </div>
              <span className="text-sm text-[#1C1917]">{task.assignee?.name ?? '—'}</span>
            </div>
          </div>

          {task.due_date && (
            <div>
              <p className="text-[13px] font-medium text-[#57534E] mb-1">Due date</p>
              <p className="text-sm text-[#1C1917]">{task.due_date}</p>
            </div>
          )}

          <div>
            <p className="text-[13px] font-medium text-[#57534E] mb-1.5">Status</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={!canChangeStatus}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm text-[#1C1917] focus:border-[#6366F1] outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#57534E] mb-1.5">
              Evidence URL <span className="font-normal text-[#A8A29E]">(optional)</span>
            </p>
            {task.evidence_url && !evidenceUrl ? (
              <a href={task.evidence_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366F1]">
                View evidence ↗
              </a>
            ) : (
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm focus:border-[#6366F1] outline-none"
              />
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#E7E5E4]">
          {canChangeStatus ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : (
                <><IconCheck size={14} /> Save changes</>
              )}
            </button>
          ) : (
            <p className="text-center text-xs text-[#A8A29E]">Only the assignee or lead can update this task.</p>
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}
