import type { Evidence, EvidenceType } from '@/types';

const TYPE_LABEL: Record<EvidenceType, string> = { file: 'File', link: 'Link', note: 'Note' };
const TYPE_COLOR: Record<EvidenceType, string> = {
  file: 'bg-[#EFF6FF] text-[#3B82F6]',
  link: 'bg-[#FFF0EE] text-[#FF5841]',
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
        <div key={e.id} className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-md p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[e.type]}`}>
              {TYPE_LABEL[e.type]}
            </span>
            <span className="text-[11px] font-semibold text-[#A8A29E]">v{e.version_number}</span>
            <span className="ml-auto text-[11px] text-[#A8A29E]">
              {new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {e.type === 'note' ? (
            <p className="text-[13px] text-[#1C1917] leading-relaxed">{e.content}</p>
          ) : (
            <a href={e.content} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-[#FF5841] underline break-all">
              {e.content}
            </a>
          )}
          {e.uploader && (
            <p className="text-[11px] text-[#A8A29E] mt-1.5">by {e.uploader.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}
