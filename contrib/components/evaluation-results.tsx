import { IconCheck } from '@/components/icons';
import type { EvaluationSummary, GroupMember } from '@/types';

interface EvaluationResultsProps {
  summaries: EvaluationSummary[];
  members: GroupMember[];
  currentUserId: string;
  memberCount: number;
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div className="h-full bg-brand rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold text-text w-7 text-right">{value}</span>
    </div>
  );
}

export default function EvaluationResults({ summaries, members, currentUserId, memberCount }: EvaluationResultsProps) {
  const mySummary = summaries.find((s) => s.evaluatee_id === currentUserId);
  const submittedCount = summaries.length > 0 ? Math.max(...summaries.map((s) => s.eval_count)) : 0;
  const totalRespondents = memberCount - 1;
  const pct = totalRespondents > 0 ? Math.round((submittedCount / totalRespondents) * 100) : 0;

  function nameFor(profileId: string) {
    return members.find((m) => m.profile_id === profileId)?.profile?.name ?? '—';
  }

  function initialsFor(profileId: string) {
    return members.find((m) => m.profile_id === profileId)?.profile?.name?.slice(0, 2).toUpperCase() ?? '??';
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
      {/* Progress */}
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#DCFCE7] text-green flex items-center justify-center"><IconCheck size={12} /></span>
            <span className="text-sm font-semibold text-text">Submitted</span>
          </div>
          <span className="text-[12px] text-text-secondary">{submittedCount} of {totalRespondents} responded</span>
        </div>
        <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Your scores */}
      {mySummary && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Your scores</p>
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="mb-3">
              <p className="text-[12px] text-text-secondary mb-1.5">Contribution</p>
              <ScoreBar value={Number(mySummary.avg_contribution)} />
            </div>
            <div className="mb-3">
              <p className="text-[12px] text-text-secondary mb-1.5">Collaboration</p>
              <ScoreBar value={Number(mySummary.avg_collaboration)} />
            </div>
            <p className="text-[11px] text-text-tertiary">Based on {mySummary.eval_count} response{mySummary.eval_count !== 1 ? 's' : ''}</p>
            {mySummary.comments && mySummary.comments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Comments received (anonymous)</p>
                {mySummary.comments.map((c, i) => (
                  <p key={i} className="text-sm text-text-secondary italic mb-1.5">"{c}"</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All members */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">All members</p>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {members.map((m, idx) => {
          const s = summaries.find((s) => s.evaluatee_id === m.profile_id);
          return (
            <div key={m.profile_id} className={`flex items-center gap-3 px-4 py-3 ${idx < members.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-brand-light text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {initialsFor(m.profile_id)}
              </div>
              <span className="text-sm text-text flex-1 min-w-0 truncate">{nameFor(m.profile_id)}</span>
              {s ? (
                <div className="flex gap-3 text-[12px] flex-shrink-0">
                  <span className="text-text-secondary">C: <span className="font-semibold text-text">{s.avg_contribution}</span></span>
                  <span className="text-text-secondary">Col: <span className="font-semibold text-text">{s.avg_collaboration}</span></span>
                </div>
              ) : (
                <span className="text-[11px] text-text-tertiary">No data yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
