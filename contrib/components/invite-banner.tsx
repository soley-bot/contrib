import { useState } from 'react';
import { IconUsers, IconCopy, IconCheck } from '@/components/icons';

interface InviteBannerProps {
  token: string;
  onReset?: () => Promise<void>;
}

export default function InviteBanner({ token, onReset }: InviteBannerProps) {
  const [copied, setCopied] = useState(false);
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'resetting' | 'done'>('idle');
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${token}`;

  function handleCopy() {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConfirmReset() {
    if (!onReset) return;
    setResetState('resetting');
    await onReset();
    setResetState('done');
    setTimeout(() => setResetState('idle'), 2000);
  }

  return (
    <div className="border-[1.5px] border-dashed border-brand-border rounded-xl bg-brand-light p-3.5 flex items-start gap-2.5 mb-4">
      <span className="mt-0.5 flex-shrink-0"><IconUsers size={20} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-brand mb-0.5">Invite link</p>
        <p className="text-xs text-text-secondary truncate">{link}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={handleCopy}
            className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
          >
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {onReset && resetState === 'idle' && (
            <button
              onClick={() => setResetState('confirm')}
              className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Reset link
            </button>
          )}
          {onReset && resetState === 'confirm' && (
            <span className="text-[11px] text-text-secondary flex items-center gap-2">
              Revoke current link?
              <button onClick={handleConfirmReset} className="text-red font-medium hover:underline">Confirm</button>
              <button onClick={() => setResetState('idle')} className="text-text-tertiary hover:underline">Cancel</button>
            </span>
          )}
          {resetState === 'resetting' && (
            <span className="text-[11px] text-text-tertiary">Resetting…</span>
          )}
          {resetState === 'done' && (
            <span className="text-[11px] text-green font-medium">Link reset</span>
          )}
        </div>
      </div>
    </div>
  );
}
