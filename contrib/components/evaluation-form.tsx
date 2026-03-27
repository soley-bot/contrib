import { useState } from 'react';
import type { GroupMember, Evaluation } from '@/types';

type EvaluationInsert = Omit<Evaluation, 'id' | 'submitted_at'>;

interface RatingState {
  evaluatee_id: string;
  contribution_score: number | null;
  collaboration_score: number | null;
  comment: string;
}

interface EvaluationFormProps {
  groupId: string;
  currentUserId: string;
  members: GroupMember[];
  onSubmit: (entries: EvaluationInsert[]) => Promise<void>;
}

export default function EvaluationForm({ groupId, currentUserId, members, onSubmit }: EvaluationFormProps) {
  const peers = members.filter((m) => m.profile_id !== currentUserId);
  const [ratings, setRatings] = useState<RatingState[]>(
    peers.map((m) => ({ evaluatee_id: m.profile_id, contribution_score: null, collaboration_score: null, comment: '' }))
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allScored = ratings.every((r) => r.contribution_score !== null && r.collaboration_score !== null);

  function setScore(idx: number, field: 'contribution_score' | 'collaboration_score', value: number) {
    setRatings((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSubmit() {
    if (!allScored) return;
    setSubmitting(true);
    await onSubmit(
      ratings.map((r) => ({
        group_id: groupId,
        evaluator_id: currentUserId,
        evaluatee_id: r.evaluatee_id,
        contribution_score: r.contribution_score!,
        collaboration_score: r.collaboration_score!,
        comment: r.comment.trim() || null,
      }))
    );
    setSubmitting(false);
    setShowConfirm(false);
  }

  if (peers.length === 0) {
    return <p className="text-sm text-text-tertiary text-center py-10">No teammates to evaluate.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-36 md:pb-8">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Review your teammates</p>

      {peers.map((member, idx) => {
        const r = ratings[idx];
        const initials = member.profile?.name?.slice(0, 2).toUpperCase() ?? '??';
        return (
          <div key={member.profile_id} className="bg-white border border-border rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-light text-brand text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{member.profile?.name ?? '—'}</p>
                {member.profile?.year_of_study && (
                  <p className="text-[11px] text-text-tertiary">Year {member.profile.year_of_study} · {member.profile.faculty ?? member.profile.university}</p>
                )}
              </div>
            </div>

            {(['contribution_score', 'collaboration_score'] as const).map((field) => (
              <div key={field} className="mb-3">
                <p className="text-[12px] font-medium text-text-secondary mb-2">
                  {field === 'contribution_score' ? 'Contribution' : 'Collaboration'}
                </p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setScore(idx, field, v)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
                        r[field] === v
                          ? 'bg-brand text-white'
                          : 'bg-bg-hover text-text-secondary hover:bg-brand-light hover:text-brand'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="text-[12px] font-medium text-text-secondary mb-1.5">
                Comment <span className="text-text-tertiary font-normal">(optional)</span>
              </p>
              <textarea
                value={r.comment}
                onChange={(e) => setRatings((prev) => prev.map((x, i) => i === idx ? { ...x, comment: e.target.value } : x))}
                placeholder="Leave a note for this teammate…"
                rows={2}
                className="w-full border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-text-tertiary resize-none focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>
        );
      })}

      <div className="fixed inset-x-0 md:static md:mt-4 p-4 md:p-0 bg-white md:bg-transparent border-t border-border md:border-0"
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: '0.5rem' }}>
        {!showConfirm ? (
          <div>
            <button onClick={() => setShowConfirm(true)} disabled={!allScored}
              className="w-full h-11 bg-brand hover:bg-brand-dark disabled:bg-bg-hover disabled:text-text-tertiary text-white text-[14px] font-semibold rounded-md transition-colors">
              Submit Peer Review
            </button>
            {!allScored && (
              <p className="text-[11px] text-text-tertiary text-center mt-1.5">Rate all teammates to submit</p>
            )}
          </div>
        ) : (
          <div className="bg-brand-light border border-[#93B4FF] rounded-md p-3">
            <p className="text-sm font-medium text-text mb-0.5">Submit peer review?</p>
            <p className="text-[12px] text-text-secondary mb-3">Your ratings cannot be changed after submitting.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 h-9 border border-border bg-white text-sm font-medium rounded-md text-text-secondary hover:bg-bg-hover transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
