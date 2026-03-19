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
      <div className="flex-1 h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
        <div className="h-full bg-[#FF5841] rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold text-[#1C1917] w-7 text-right">{value}</span>
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
      <div className="bg-white border border-[#E7E5E4] rounded-[10px] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center text-[10px] font-bold">✓</span>
            <span className="text-sm font-semibold text-[#1C1917]">Submitted</span>
          </div>
          <span className="text-[12px] text-[#57534E]">{submittedCount} of {totalRespondents} responded</span>
        </div>
        <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
          <div className="h-full bg-[#FF5841] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Your scores */}
      {mySummary && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-2">Your scores</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[10px] p-4">
            <div className="mb-3">
              <p className="text-[12px] text-[#57534E] mb-1.5">Contribution</p>
              <ScoreBar value={Number(mySummary.avg_contribution)} />
            </div>
            <div className="mb-3">
              <p className="text-[12px] text-[#57534E] mb-1.5">Collaboration</p>
              <ScoreBar value={Number(mySummary.avg_collaboration)} />
            </div>
            <p className="text-[11px] text-[#A8A29E]">Based on {mySummary.eval_count} response{mySummary.eval_count !== 1 ? 's' : ''}</p>
            {mySummary.comments && mySummary.comments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E7E5E4]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-2">Comments received (anonymous)</p>
                {mySummary.comments.map((c, i) => (
                  <p key={i} className="text-sm text-[#57534E] italic mb-1.5">"{c}"</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All members */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-2">All members</p>
      <div className="bg-white border border-[#E7E5E4] rounded-[10px] overflow-hidden">
        {members.map((m, idx) => {
          const s = summaries.find((s) => s.evaluatee_id === m.profile_id);
          return (
            <div key={m.profile_id} className={`flex items-center gap-3 px-4 py-3 ${idx < members.length - 1 ? 'border-b border-[#E7E5E4]' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-[#FFF0EE] text-[#FF5841] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {initialsFor(m.profile_id)}
              </div>
              <span className="text-sm text-[#1C1917] flex-1 min-w-0 truncate">{nameFor(m.profile_id)}</span>
              {s ? (
                <div className="flex gap-3 text-[12px] flex-shrink-0">
                  <span className="text-[#57534E]">C: <span className="font-semibold text-[#1C1917]">{s.avg_contribution}</span></span>
                  <span className="text-[#57534E]">Col: <span className="font-semibold text-[#1C1917]">{s.avg_collaboration}</span></span>
                </div>
              ) : (
                <span className="text-[11px] text-[#A8A29E]">No data yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
