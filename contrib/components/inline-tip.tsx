import { useState, useEffect } from 'react';

interface InlineTipProps {
  id: string;
  children: React.ReactNode;
}

export default function InlineTip({ id, children }: InlineTipProps) {
  const storageKey = `contrib_tip_${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch {}
  }, [storageKey]);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  }

  if (!visible) return null;

  return (
    <div className="bg-[#EBF0FF] border-l-3 border-l-brand rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
        <circle cx="8" cy="8" r="7" stroke="#1A56E8" strokeWidth="1.5"/>
        <path d="M8 7v4" stroke="#1A56E8" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="5" r="0.75" fill="#1A56E8"/>
      </svg>
      <p className="text-[13px] text-text-secondary flex-1">{children}</p>
      <button onClick={dismiss} className="flex-shrink-0 p-0.5 text-text-tertiary hover:text-text transition-colors" aria-label="Dismiss tip">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
