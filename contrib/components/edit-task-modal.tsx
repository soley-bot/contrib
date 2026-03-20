import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import type { Task, GroupMember } from '@/types';

interface EditTaskModalProps {
  task: Task;
  members: GroupMember[];
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditTaskModal({ task, members, userId, onClose, onUpdated }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const assigneeChanged = assigneeId !== task.assignee_id;

    await supabase.from('tasks').update({
      title: title.trim(),
      description: description.trim() || null,
      assignee_id: assigneeId,
      due_date: dueDate || null,
    }).eq('id', task.id);

    await supabase.from('activity_log').insert({
      group_id: task.group_id,
      actor_id: userId,
      action: 'task_edited',
      task_id: task.id,
      meta: { task_title: title.trim() },
    });

    if (assigneeChanged) {
      const newAssignee = members.find((m) => m.profile_id === assigneeId);
      await supabase.from('activity_log').insert({
        group_id: task.group_id,
        actor_id: userId,
        action: 'task_reassigned',
        task_id: task.id,
        meta: { task_title: title.trim(), to_name: newAssignee?.profile?.name ?? '' },
      });
    }

    setSaving(false);
    onUpdated();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:max-w-[480px] bg-white rounded-t-[20px] md:rounded-[10px] max-h-[90dvh] overflow-y-auto"
        style={{ animation: 'slideUp .25s ease' }}
      >
        <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
          <h2 className="text-base font-semibold text-[#1C1917]">Edit task</h2>
          <button onClick={onClose} className="text-[#57534E] hover:text-[#1C1917] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-[#57534E] mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#57534E] mb-1.5 block">
              Description <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm focus:border-brand outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#57534E] mb-1.5 block">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm text-[#1C1917] focus:border-brand outline-none bg-white"
            >
              {members.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>{m.profile?.name ?? m.profile_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#57534E] mb-1.5 block">
              Due date <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#E7E5E4]">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving…' : <><IconCheck size={14} /> Save changes</>}
          </button>
        </div>
        <style jsx>{`
          @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        `}</style>
      </div>
    </div>
  );
}
