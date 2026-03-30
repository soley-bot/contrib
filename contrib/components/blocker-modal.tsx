import { useState } from 'react';
import { IconBan } from '@/components/icons';

interface BlockerModalProps {
  groupId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function BlockerModal({ groupId, onClose, onCreated }: BlockerModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/blockers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save. Please try again.'); return; }
      onCreated();
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:max-w-[480px] bg-white rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto"
        style={{ animation: 'slideUp .25s ease' }}
        role="dialog"
        aria-label="Declare a blocker"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#FEE2E2] flex items-center justify-center">
              <IconBan size={14} />
            </div>
            <h2 className="text-[15px] font-semibold text-[#0F172A]">Heads Up</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#475569] transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-[13px] text-[#475569]">
              Let your group know you&apos;re temporarily unavailable. No details required — just a brief note.
            </p>
            <textarea
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[14px] text-[#0F172A] placeholder-[#CBD5E1] resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              rows={3}
              placeholder="e.g. Busy with exams this week, back on Friday"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div className="flex items-center justify-between">
              {error
                ? <p className="text-[12px] text-[#DC2626]">{error}</p>
                : <span />
              }
              <p className="text-[11px] text-[#CBD5E1] ml-auto">{reason.length}/500</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#E2E8F0] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[13px] font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 3}
              className="h-9 px-4 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Notify group'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 768px) {
          @keyframes slideUp {
            from { transform: translateY(8px); opacity: 0; }
            to   { transform: translateY(0);   opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
