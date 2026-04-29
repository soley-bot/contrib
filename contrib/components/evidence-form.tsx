import { useRef, useState } from 'react';
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

type TabDef = { value: EvidenceType; label: string; hint: string };

const TABS: TabDef[] = [
  { value: 'file', label: 'Upload proof', hint: 'Pick a file from your device (PDF, image, docx, up to 4 MB).' },
  { value: 'link', label: 'Link',        hint: 'Paste a shareable URL.' },
  { value: 'note', label: 'Note',        hint: 'Describe what you did.' },
];

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceForm({ taskId, taskTitle, groupId, userId, nextVersion, onSaved, onCancel }: EvidenceFormProps) {
  const [type, setType] = useState<EvidenceType>('file');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Props retained for interface stability. The API route reads the authenticated user
  // from the session, derives group_id via task_id, and writes activity_log server-side —
  // so these are no longer used in the client.
  void userId;
  void groupId;
  void taskTitle;

  async function handleSubmit() {
    if (savingRef.current) return;
    savingRef.current = true;
    setError('');

    if (type === 'file') {
      if (!file) { setError('Choose a file to upload.'); savingRef.current = false; return; }
      if (file.size > MAX_FILE_BYTES) { setError('File exceeds 4 MB limit.'); savingRef.current = false; return; }
    } else if (type === 'link') {
      if (!/^https?:\/\//i.test(content.trim())) { setError('Enter a valid URL starting with http:// or https://'); savingRef.current = false; return; }
    } else {
      if (!content.trim()) { setError('Write a short note.'); savingRef.current = false; return; }
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('task_id', taskId);
      if (type === 'file' && file) form.append('file', file);
      else form.append('content', content.trim());

      const resp = await fetch('/api/evidence/create', { method: 'POST', body: form });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error ?? 'Failed to save work proof.');
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
      setSaving(false);
    } finally {
      savingRef.current = false;
    }
  }

  const active = TABS.find((t) => t.value === type)!;

  return (
    <div aria-label="Log your work" className="flex flex-col gap-3 bg-bg border border-border rounded-md p-3">
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t.value} type="button"
            onClick={() => { setType(t.value); setContent(''); setFile(null); setError(''); }}
            className={`flex-1 h-8 rounded-md text-[12px] font-medium border transition-colors ${
              type === t.value ? 'bg-brand text-white border-brand' : 'bg-white text-text-secondary border-border'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-text-tertiary">{active.hint}</p>

      {type === 'file' ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setError(''); }}
            className="text-[13px]"
          />
          {file && (
            <p className="text-[12px] text-text-secondary">
              {file.name} · {formatSize(file.size)}{' '}
              <button type="button" className="text-brand underline" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                clear
              </button>
            </p>
          )}
        </div>
      ) : type === 'note' ? (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={2000}
          placeholder="Describe what you did…"
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none resize-none bg-white" />
      ) : (
        <input type="url" value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000}
          placeholder="https://…"
          className="w-full border border-border rounded-md px-3 py-2 text-[14px] focus:border-brand outline-none bg-white" />
      )}

      {error && <p role="alert" className="text-xs text-red">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border border-border text-[13px] font-medium text-text-secondary rounded-md hover:bg-bg-hover transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="flex-1 h-9 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60">
          {saving ? (type === 'file' ? 'Uploading…' : 'Saving…') : nextVersion === 1 ? 'Log your work' : 'Add version'}
        </button>
      </div>
    </div>
  );
}
