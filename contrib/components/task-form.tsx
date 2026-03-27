import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose } from '@/components/icons';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import type { GroupMember } from '@/types';

interface TaskFormProps {
  groupId: string;
  members: GroupMember[];
  userId: string;
  onCreated: () => void;
  onClose: () => void;
}

export default function TaskForm({ groupId, members, userId, onCreated, onClose }: TaskFormProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose);
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
    await supabase.from('activity_log').insert([
      {
        group_id: groupId, actor_id: userId, action: 'task_created',
        task_id: task.id, meta: { task_title: title.trim(), assignee_name: assigneeMember?.profile?.name ?? null },
      },
      {
        group_id: groupId, actor_id: assignee, action: 'task_assigned',
        task_id: task.id, meta: { task_title: title.trim() },
      },
    ]);

    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={modalRef} className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto" role="dialog" aria-labelledby="task-form-title">
        <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="task-form-title" className="text-base font-semibold text-text">Add Task</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="task-title" className="text-[13px] font-medium text-text-secondary">Task title</label>
            <input id="task-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Write executive summary"
              aria-describedby="task-form-error"
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="task-description" className="text-[13px] font-medium text-text-secondary">Description <span className="font-normal text-text-tertiary">(optional)</span></label>
            <textarea id="task-description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Add details…"
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none resize-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-text-secondary">Assign to</label>
            <div className="flex flex-wrap gap-2 pt-0.5" role="group" aria-label="Assign to">
              {members.map((m) => (
                <button
                  key={m.profile_id}
                  type="button"
                  onClick={() => setAssignee(m.profile_id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    assignee === m.profile_id
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-text-secondary border-border'
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
            <label htmlFor="task-due-date" className="text-[13px] font-medium text-text-secondary">Due date <span className="font-normal text-text-tertiary">(optional)</span></label>
            <input id="task-due-date" type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          {error && <p id="task-form-error" role="alert" className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-border">
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
