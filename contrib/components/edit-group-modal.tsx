import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import type { Group } from '@/types';

interface EditGroupModalProps {
  group: Group;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditGroupModal({ group, userId, onClose, onUpdated }: EditGroupModalProps) {
  const [name, setName] = useState(group.name);
  const [subject, setSubject] = useState(group.subject);
  const [dueDate, setDueDate] = useState(group.due_date ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !subject.trim()) return;
    setSaving(true);

    await supabase.from('groups').update({
      name: name.trim(),
      subject: subject.trim(),
      due_date: dueDate || null,
    }).eq('id', group.id);

    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: userId,
      action: 'group_updated',
      task_id: null,
      meta: null,
    });

    setSaving(false);
    onUpdated();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[440px] bg-white rounded-xl" role="dialog" aria-labelledby="edit-group-title">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="edit-group-title" className="text-base font-semibold text-text">Edit group</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Subject code</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              Due date <span className="font-normal text-text-tertiary">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-brand outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !subject.trim()}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving…' : <><IconCheck size={14} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
