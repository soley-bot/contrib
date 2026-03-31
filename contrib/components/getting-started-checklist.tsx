import { useState, useEffect } from 'react';
import { IconCheck } from '@/components/icons';

interface ChecklistProps {
  groupId: string;
  hasTasks: boolean;
  hasTeammates: boolean;
  hasEvidence: boolean;
}

export default function GettingStartedChecklist({ groupId, hasTasks, hasTeammates, hasEvidence }: ChecklistProps) {
  const storageKey = `contrib_checklist_${groupId}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setDismissed(false);
    } catch {}
  }, [storageKey]);

  const allDone = hasTasks && hasTeammates && hasEvidence;

  // Auto-dismiss when all complete
  useEffect(() => {
    if (allDone && !dismissed) {
      try { localStorage.setItem(storageKey, '1'); } catch {}
    }
  }, [allDone, dismissed, storageKey]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  }

  if (dismissed) return null;

  const items = [
    { done: hasTasks, label: 'Add your first task' },
    { done: hasTeammates, label: 'Invite a teammate' },
    { done: hasEvidence, label: 'Log evidence on a task' },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="bg-white border border-border rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[14px] font-semibold text-text">Getting started</p>
          <p className="text-[12px] text-text-tertiary mt-0.5">{doneCount} of {items.length} complete</p>
        </div>
        <button onClick={dismiss} className="text-[12px] text-text-tertiary hover:text-text transition-colors">
          Dismiss
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.done ? 'bg-[#16A34A]' : 'border-2 border-border'
            }`}>
              {item.done && <IconCheck size={12} />}
            </div>
            <span className={`text-[13px] ${item.done ? 'text-text-tertiary line-through' : 'text-text font-medium'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
