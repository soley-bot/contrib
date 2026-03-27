import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvidenceType } from '@/types';

interface EvidenceFormProps {
  taskId: string;
  taskTitle: string;
  groupId: string;
  userId: string;
  nextVersion: number;
  onSaved: () => void;
  onCancel: () => void;
}

const TYPES: { value: EvidenceType; label: string; placeholder: string; isText: boolean }[] = [
  { value: 'file',  label: 'File link', placeholder: 'https://drive.google.com/…', isText: false },
  { value: 'link',  label: 'Link',      placeholder: 'https://…',                  isText: false },
  { value: 'note',  label: 'Note',      placeholder: 'Describe what you did…',     isText: true  },
];

export default function EvidenceForm({ taskId, taskTitle, groupId, userId, nextVersion, onSaved, onCancel }: EvidenceFormProps) {
  const [type, setType] = useState<EvidenceType>('link');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeType = TYPES.find((t) => t.value === type)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!content.trim()) { setError('Content is required.'); return; }
    setSaving(true);

    const { error: insertError } = await supabase.from('evidence').insert({
      task_id: taskId, uploaded_by: userId, type, content: content.trim(), version_number: nextVersion,
    });
    if (insertError) { setError(insertError.message); setSaving(false); return; }

    await supabase.from('activity_log').insert({
      group_id: groupId, actor_id: userId,
      action: nextVersion === 1 ? 'evidence_added' : 'evidence_version_added',
      meta: { task_title: taskTitle },
    });

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Log your work" className="flex flex-col gap-3 bg-bg border border-border rounded-md p-3">
      <div className="flex gap-1.5">
        {TYPES.map((t) => (
          <button key={t.value} type="button"
            onClick={() => { setType(t.value); setContent(''); }}
            className={`flex-1 h-8 rounded-md text-[12px] font-medium border transition-colors ${
              type === t.value ? 'bg-brand text-white border-brand' : 'bg-white text-text-secondary border-border'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeType.isText ? (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
          placeholder={activeType.placeholder}
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none resize-none bg-white" />
      ) : (
        <input type="url" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={activeType.placeholder}
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none bg-white" />
      )}

      {error && <p className="text-xs text-red">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border border-border text-[13px] font-medium text-text-secondary rounded-md hover:bg-bg-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 h-9 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : nextVersion === 1 ? 'Add evidence' : 'Upload version'}
        </button>
      </div>
    </form>
  );
}
