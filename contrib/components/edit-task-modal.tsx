import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import { useToast } from '@/components/toast-provider';
import type { Task, GroupMember } from '@/types';

interface EditTaskModalProps {
  task: Task;
  members: GroupMember[];
  userId: string;
  groupName?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditTaskModal({ task, members, userId, groupName, onClose, onUpdated }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
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
        className="w-full md:max-w-[480px] bg-white rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto"
        style={{ animation: 'slideUp .25s ease' }}
        role="dialog" aria-labelledby="edit-task-title"
      >
        <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 id="edit-task-title" className="text-base font-semibold text-[#0F172A]">Edit task</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-[#0F172A] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-[#475569] mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#475569] mb-1.5 block">
              Description <span className="font-normal text-[#94A3B8]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm focus:border-brand outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#475569] mb-1.5 block">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] focus:border-brand outline-none bg-white"
            >
              {members.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>{m.profile?.name ?? m.profile_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#475569] mb-1.5 block">
              Due date <span className="font-normal text-[#94A3B8]">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#E2E8F0]">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving…' : <><IconCheck size={14} /> Save changes</>}
          </button>
        </div>
        </form>
        <style jsx>{`
          @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        `}</style>
      </div>
    </div>
  );
}
