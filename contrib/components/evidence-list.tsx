import { useState } from 'react';
import type { Evidence, EvidenceType } from '@/types';

const TYPE_LABEL: Record<EvidenceType, string> = { file: 'File', link: 'Link', note: 'Note' };
const TYPE_COLOR: Record<EvidenceType, string> = {
  file: 'bg-brand-light text-brand',
  link: 'bg-brand-light text-brand',
  note: 'bg-[#F0FDF4] text-green',
};

interface EvidenceListProps {
  evidence: Evidence[];
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceList({ evidence }: EvidenceListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleDownload(e: Evidence) {
    if (downloadingId) return;
    setDownloadingId(e.id);
    setRowError((prev) => ({ ...prev, [e.id]: '' }));
    try {
      const resp = await fetch(`/api/evidence/download-url?id=${encodeURIComponent(e.id)}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.url) {
        setRowError((prev) => ({ ...prev, [e.id]: data.error ?? 'Download failed.' }));
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setRowError((prev) => ({ ...prev, [e.id]: 'Network error.' }));
    } finally {
      setDownloadingId(null);
    }
  }

  if (evidence.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {evidence.map((e) => {
        const isUploadedFile = e.type === 'file' && !!e.file_path;
        return (
          <div key={e.id} className="bg-bg border border-border rounded-md p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>
              <span className="text-[11px] font-semibold text-text-tertiary">v{e.version_number}</span>
              <span className="ml-auto text-[11px] text-text-tertiary">
                {new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {e.type === 'note' ? (
              <p className="text-[13px] text-text leading-relaxed">{e.content}</p>
            ) : isUploadedFile ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button"
                  disabled={downloadingId === e.id}
                  onClick={() => handleDownload(e)}
                  className="text-[13px] text-brand underline break-all text-left disabled:opacity-60"
                  aria-label={`Download ${e.file_name ?? e.content}`}>
                  {e.file_name ?? e.content}
                </button>
                {e.file_size != null && (
                  <span className="text-[11px] text-text-tertiary">· {formatSize(e.file_size)}</span>
                )}
                {downloadingId === e.id && <span className="text-[11px] text-text-tertiary">· fetching link…</span>}
              </div>
            ) : (
              <a href={e.content} target="_blank" rel="noopener noreferrer"
                className="text-[13px] text-brand underline break-all">
                {e.content}
              </a>
            )}
            {rowError[e.id] && <p role="alert" className="mt-1 text-[11px] text-red">{rowError[e.id]}</p>}
            {e.uploader && (
              <p className="text-[11px] text-text-tertiary mt-1.5">by {e.uploader.name}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
