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
      <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto" role="dialog" aria-labelledby="task-form-title">
        <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 id="task-form-title" className="text-base font-semibold text-[#0F172A]">Add Task</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-[#475569] hover:text-[#0F172A] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Task title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Write executive summary"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Description <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Add details…"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none resize-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Assign to</label>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {members.map((m) => (
                <button
                  key={m.profile_id}
                  type="button"
                  onClick={() => setAssignee(m.profile_id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    assignee === m.profile_id
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-[#475569] border-[#E2E8F0]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${assignee === m.profile_id ? 'bg-white/20 text-white' : 'bg-brand-light text-brand'}`}>
                    {m.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
                  </span>
                  {m.profile?.name ?? m.profile_id}{m.profile_id === userId ? ' (me)' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Due date <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-[#E2E8F0]">
            <button type="submit" disabled={creating}
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
              {creating ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
