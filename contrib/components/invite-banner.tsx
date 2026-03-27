import { useState } from 'react';
import { IconUsers, IconCopy, IconCheck } from '@/components/icons';

interface InviteBannerProps {
  token: string;
}

export default function InviteBanner({ token }: InviteBannerProps) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${token}`;

  function handleCopy() {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-[1.5px] border-dashed border-brand-border rounded-xl bg-brand-light p-3.5 flex items-center gap-2.5 mb-4">
      <IconUsers size={20} />
      <div className="flex-1 min-w-0" style={{ color: 'var(--brand)' }}>
        <p className="text-[11px] font-semibold text-brand mb-0.5">Invite link</p>
        <p className="text-xs text-text-secondary truncate">{link}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 h-8 px-3 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
