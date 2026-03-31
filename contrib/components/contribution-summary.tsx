import { CONTRIBUTION_TYPES } from '@/types';
import type { ContributionCounts } from '@/hooks/use-contribution-summary';

interface ContributionSummaryProps {
  counts: ContributionCounts;
}

export default function ContributionSummary({ counts }: ContributionSummaryProps) {
  if (counts.total === 0) return null;

  const max = Math.max(counts.task, counts.research, counts.meeting, counts.discussion, counts.coordination, 1);

  const rows: { label: string; value: number }[] = CONTRIBUTION_TYPES
    .map((t) => ({ label: t.label, value: counts[t.value] }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-text">Your contributions</span>
        <span className="text-[12px] text-text-tertiary">{counts.total} total</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 md:gap-2">
            <div className="w-[72px] md:w-[85px] text-[11px] md:text-[12px] text-text-secondary text-right flex-shrink-0">
              {row.label}
            </div>
            <div className="flex-1 h-4 md:h-[18px] bg-brand-light rounded overflow-hidden">
              <div
                className="h-full bg-brand rounded transition-all"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
            <div className="w-4 md:w-5 text-[11px] md:text-[12px] text-text-secondary font-medium flex-shrink-0">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
