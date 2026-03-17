import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose } from '@/components/icons';
import type { GroupMember } from '@/types';

interface TaskFormProps {
  groupId: string;
  members: GroupMember[];
  userId: string;
  onCreated: () => void;
  onClose: () => void;
}

export default function TaskForm({ groupId, members, userId, onCreated, onClose }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !assignee) { setError('Title and assignee are required.'); return; }
    setCreating(true);

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({ group_id: groupId, title: title.trim(), description: desc.trim() || null, assignee_id: assignee, due_date: due || null, status: 'todo' })
      .select().single();

    if (taskError || !task) { setError(taskError?.message ?? 'Failed to create task.'); setCreating(false); return; }

    const assigneeMember = members.find((m) => m.profile_id === assignee);
    await supabase.from('activity_log').insert({
      group_id: groupId, actor_id: userId, action: 'task_created',
      task_id: task.id, meta: { task_title: title.trim(), assignee_name: assigneeMember?.profile?.name ?? null },
    });

    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px] max-h-[90dvh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
          <h2 className="text-base font-semibold text-[#1C1917]">Add Task</h2>
          <button onClick={onClose} className="text-[#57534E] hover:text-[#1C1917] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Task title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Write executive summary"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Description <span className="font-normal text-[#A8A29E]">(optional)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Add details…"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none resize-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Assign to</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white">
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>
                  {m.profile?.name ?? m.profile_id}{m.profile_id === userId ? ' (me)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-[#E7E5E4]">
            <button type="submit" disabled={creating}
              className="w-full h-11 bg-[#FF5841] hover:bg-[#E04030] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
              {creating ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
