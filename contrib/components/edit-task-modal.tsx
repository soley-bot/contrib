import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useToast } from '@/components/toast-provider';
import { CONTRIBUTION_TYPES } from '@/types';
import type { Task, GroupMember, ContributionType } from '@/types';

interface EditTaskModalProps {
  task: Task;
  members: GroupMember[];
  userId: string;
  groupName?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditTaskModal({ task, members, userId, groupName, onClose, onUpdated }: EditTaskModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [contributionType, setContributionType] = useState<ContributionType>(task.contribution_type ?? 'task');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSave() {
    if (saving) return;
    if (!title.trim()) return;
    setSaving(true);
    const assigneeChanged = assigneeId !== task.assignee_id;

    const { error: updateError } = await supabase.from('tasks').update({
      title: title.trim(),
      description: description.trim() || null,
      assignee_id: assigneeId,
      due_date: dueDate || null,
      contribution_type: contributionType,
    }).eq('id', task.id);
    if (updateError) { setSaving(false); showToast('Failed to save changes.'); return; }

    const { error: logError } = await supabase.from('activity_log').insert({
      group_id: task.group_id,
      actor_id: userId,
      action: 'task_edited',
      task_id: task.id,
      meta: { task_title: title.trim() },
    });
    if (logError) { setSaving(false); showToast('Failed to save changes.'); return; }

    if (assigneeChanged) {
      const newAssignee = members.find((m) => m.profile_id === assigneeId);
      const { error: reassignError } = await supabase.from('activity_log').insert({
        group_id: task.group_id,
        actor_id: userId,
        action: 'task_reassigned',
        task_id: task.id,
        meta: { task_title: title.trim(), to_name: newAssignee?.profile?.name ?? '' },
      });
      if (reassignError) { setSaving(false); showToast('Failed to save changes.'); return; }

      // Notify new assignee (fire-and-forget)
      if (assigneeId !== userId) {
        supabase.from('notifications').insert({
          recipient_id: assigneeId,
          group_id: task.group_id,
          type: 'task_assigned',
          title: `You were assigned "${title.trim()}"`,
          meta: { taskId: task.id, groupName: groupName ?? null },
        }).then(null, () => {});
      }

      // Notify group via Telegram (fire-and-forget)
      const assigneeName = members.find((m) => m.profile_id === assigneeId)?.profile?.name ?? 'someone';
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: task.group_id, message: `Task "${title.trim()}" reassigned to ${assigneeName}`, type: 'contributions' }),
      }).catch(() => {});
    }

    setSaving(false);
    onUpdated();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        ref={modalRef}
        className="w-full md:max-w-[480px] bg-white rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto animate-slide-up"
        role="dialog" aria-labelledby="edit-task-title"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="edit-task-title" className="text-base font-semibold text-text">Edit Task</h2>
          <button onClick={() => { if (!saving) onClose(); }} className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="edit-task-title" className="text-[13px] font-medium text-text-secondary mb-1.5 block">Title</label>
            <input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-task-description" className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              Description <span className="font-normal text-text-tertiary">(optional)</span>
            </label>
            <textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block" id="edit-task-type-label">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRIBUTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setContributionType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                    contributionType === t.value
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-text-secondary border-border hover:border-brand/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="edit-task-assignee" className="text-[13px] font-medium text-text-secondary mb-1.5 block">Assignee</label>
            <select
              id="edit-task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm text-text focus:border-brand outline-none bg-white"
            >
              {members.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>{m.profile?.name ?? m.profile_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-task-due-date" className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              Due date <span className="font-normal text-text-tertiary">(optional)</span>
            </label>
            <input
              id="edit-task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving…' : <><IconCheck size={14} /> Save changes</>}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
