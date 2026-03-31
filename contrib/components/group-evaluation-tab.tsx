import EvaluationForm from '@/components/evaluation-form';
import EvaluationResults from '@/components/evaluation-results';
import InlineTip from '@/components/inline-tip';
import { IconCheck } from '@/components/icons';
import type { GroupMember, EvaluationInsert, EvaluationSummary, EvaluationSession } from '@/types';

interface GroupEvaluationTabProps {
  groupId: string;
  userId: string;
  isLead: boolean;
  members: GroupMember[];
  evalSession: EvaluationSession | null;
  hasSubmitted: boolean;
  evalSummaries: EvaluationSummary[];
  onOpenEvaluation: () => void;
  onSubmitEvaluation: (entries: EvaluationInsert[]) => Promise<void>;
  onShowResetEval: () => void;
}

export default function GroupEvaluationTab({
  groupId, userId, isLead, members,
  evalSession, hasSubmitted, evalSummaries,
  onOpenEvaluation, onSubmitEvaluation, onShowResetEval,
}: GroupEvaluationTabProps) {
  return (
    <div>
      {/* Not open */}
      {!evalSession && (
        <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-3">
          <InlineTip id="eval-explainer">When all tasks are done, the group lead opens Peer Review. Each member rates everyone else&apos;s contribution anonymously.</InlineTip>
          <p className="text-[15px] font-semibold text-text">Peer Review</p>
          <p className="text-sm text-text-secondary max-w-xs">
            When all work is done, the lead opens peer review so teammates can rate each other&apos;s contributions.
          </p>
          {isLead ? (
            <button onClick={onOpenEvaluation}
              className="mt-2 h-10 px-5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-md transition-colors">
              Open Peer Review
            </button>
          ) : (
            <p className="text-sm text-text-tertiary">
              Waiting for the lead to open peer review.
            </p>
          )}
        </div>
      )}

      {/* Open + not yet submitted */}
      {evalSession && !hasSubmitted && (
        <EvaluationForm
          groupId={groupId}
          currentUserId={userId}
          members={members}
          onSubmit={onSubmitEvaluation}
        />
      )}

      {/* Open + not yet submitted — reset button */}
      {evalSession && !hasSubmitted && isLead && (
        <div className="flex justify-center mt-2 pb-4">
          <button onClick={onShowResetEval}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
            Reset evaluation
          </button>
        </div>
      )}

      {/* Open + submitted */}
      {evalSession && hasSubmitted && (
        <>
          {/* Post-submission guidance */}
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <IconCheck size={14} />
                <p className="text-sm font-medium text-[#15803D]">Your review is submitted</p>
              </div>
              <p className="text-[13px] text-[#166534]">
                {evalSummaries.length > 0
                  ? `${Math.max(...evalSummaries.map(s => s.eval_count))} of ${members.length} members have responded.`
                  : 'Waiting for other members to respond.'}
                {isLead
                  ? ' You can export the Contribution Record once everyone submits.'
                  : ' The group lead will export the Contribution Record when ready.'}
              </p>
            </div>
          </div>
          <EvaluationResults
            summaries={evalSummaries}
            members={members}
            currentUserId={userId}
            memberCount={members.length}
          />
          {isLead && (
            <div className="flex justify-center mt-2 pb-4">
              <button onClick={onShowResetEval}
                className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
                Reset evaluation
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
