import type { Evidence, EvidenceType } from '@/types';

const TYPE_LABEL: Record<EvidenceType, string> = { file: 'File', link: 'Link', note: 'Note' };
const TYPE_COLOR: Record<EvidenceType, string> = {
  file: 'bg-brand-light text-brand',
  link: 'bg-brand-light text-brand',
  note: 'bg-[#F0FDF4] text-[#16A34A]',
};

interface EvidenceListProps {
  evidence: Evidence[];
}

export default function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {evidence.map((e) => (
        <div key={e.id} className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-md p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[e.type]}`}>
              {TYPE_LABEL[e.type]}
            </span>
            <span className="text-[11px] font-semibold text-[#94A3B8]">v{e.version_number}</span>
            <span className="ml-auto text-[11px] text-[#94A3B8]">
              {new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {e.type === 'note' ? (
            <p className="text-[13px] text-[#0F172A] leading-relaxed">{e.content}</p>
          ) : (
            <a href={e.content} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-brand underline break-all">
              {e.content}
            </a>
          )}
          {e.uploader && (
            <p className="text-[11px] text-[#94A3B8] mt-1.5">by {e.uploader.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}
