import { useState, useRef, useEffect } from 'react';

interface ChangelogItem {
  title: string;
  description: string;
}

interface ChangelogEntry {
  version: number;
  date: string;
  items: ChangelogItem[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 4,
    date: '2026-04-02',
    items: [
      { title: 'Notification preferences', description: 'Choose which Telegram notifications you receive — contributions, blockers, deadlines, or weekly digest.' },
      { title: 'Easier Telegram setup', description: 'Tap the bot link directly from the profile page instead of searching in Telegram.' },
    ],
  },
  {
    version: 3,
    date: '2026-04-01',
    items: [
      { title: 'Task comments', description: 'Discuss tasks with your group. Post comments, coordinate work, and keep the conversation in context.' },
    ],
  },
  {
    version: 2,
    date: '2026-03-31',
    items: [
      { title: 'Deadline reminders', description: 'Get notified 24h before tasks and group deadlines via Telegram and in-app.' },
      { title: 'Contribution summary', description: 'See your completed work by type on the dashboard.' },
      { title: 'Auto-archive', description: 'Completed groups automatically move to "Past groups".' },
      { title: 'Teacher weekly digest', description: 'Teachers get a Monday summary of all courses via Telegram.' },
    ],
  },
  {
    version: 1,
    date: '2026-03-30',
    items: [
      { title: 'Telegram notifications', description: '6 notification types delivered to Telegram.' },
      { title: 'Shareable contribution records', description: 'Generate a public link to share your group contributions.' },
    ],
  },
];

const LATEST_VERSION = Math.max(...CHANGELOG.map((e) => e.version));
const STORAGE_KEY = 'contrib_changelog_seen';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WhatsNew({ sidebar }: { sidebar?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [seenVersion, setSeenVersion] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const seen = stored ? parseInt(stored, 10) : 0;
      setSeenVersion(seen);
      if (seen < LATEST_VERSION) setHasUnseen(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open) {
      setHasUnseen(false);
      try { localStorage.setItem(STORAGE_KEY, String(LATEST_VERSION)); } catch {}
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className={sidebar
          ? 'w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium text-muted hover:bg-brand-light transition-colors'
          : 'relative w-11 h-11 flex items-center justify-center flex-shrink-0 active:opacity-80'
        }
        aria-label="What's new"
      >
        <span className="relative flex-shrink-0">
          <svg width={sidebar ? 16 : 20} height={sidebar ? 16 : 20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2l2.3 4.6 5 .7-3.6 3.5.8 5L10 13.4 5.5 15.8l.8-5L2.7 7.3l5-.7L10 2z" />
          </svg>
          {hasUnseen && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand" style={{ border: '2px solid white' }} />
          )}
        </span>
        {sidebar && 'What\u2019s new'}
      </button>

      {open && (
        <div className={
          sidebar
            ? 'absolute left-full top-0 ml-2 w-72 bg-white border border-border rounded-xl shadow-dropdown max-h-[400px] overflow-y-auto z-[200]'
            : 'absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-dropdown max-h-[400px] overflow-y-auto z-[200]'
        }>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold text-text">What&apos;s New</span>
          </div>
          <div className="p-3 flex flex-col gap-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version}>
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-2">
                  {formatDate(entry.date)}
                </p>
                <div className="flex flex-col gap-2.5">
                  {entry.items.map((item) => (
                    <div key={item.title} className="flex gap-2.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0"
                        style={{ backgroundColor: entry.version > seenVersion ? '#1A56E8' : '#E2E8F0' }}
                      />
                      <div>
                        <p className="text-[13px] font-medium text-text">{item.title}</p>
                        <p className="text-[12px] text-text-secondary mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
