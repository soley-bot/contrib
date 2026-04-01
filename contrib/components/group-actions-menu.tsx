import { useState, useRef, useEffect } from 'react';
import { IconMore, IconPencil, IconLink, IconExport, IconCrown, IconTrash, IconUsers } from '@/components/icons';

interface GroupActionsMenuProps {
  isLead: boolean;
  inviteToken: string;
  onEditGroup: () => void;
  onCopyInvite: () => void;
  onExport: () => void;
  onShareReport: () => void;
  onTransferLead: () => void;
  onDeleteGroup: () => void;
  onLeaveGroup: () => void;
}

export default function GroupActionsMenu({
  isLead, inviteToken, onEditGroup, onCopyInvite, onExport, onShareReport,
  onTransferLead, onDeleteGroup, onLeaveGroup,
}: GroupActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleAction(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-md transition-colors"
        title="Group actions"
        aria-label="Group actions"
        aria-expanded={open}
      >
        <IconMore size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-white border border-border rounded-lg shadow-dropdown z-50 py-1">
          <button onClick={() => handleAction(onEditGroup)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors">
            <IconPencil size={14} /> Edit group
          </button>
          {inviteToken && (
            <button onClick={() => handleAction(onCopyInvite)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors">
              <IconLink size={14} /> Copy invite link
            </button>
          )}
          <div className="h-px bg-border mx-2 my-1" />
          <button onClick={() => handleAction(onExport)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors">
            <IconExport size={14} /> Export PDF
          </button>
          <button onClick={() => handleAction(onShareReport)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors">
            <IconLink size={14} /> Share report
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          {isLead && (
            <button onClick={() => handleAction(onTransferLead)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors">
              <IconCrown size={14} /> Transfer lead
            </button>
          )}
          {isLead ? (
            <button onClick={() => handleAction(onDeleteGroup)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors">
              <IconTrash size={14} /> Delete group
            </button>
          ) : (
            <button onClick={() => handleAction(onLeaveGroup)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors">
              <IconUsers size={14} /> Leave group
            </button>
          )}
        </div>
      )}
    </div>
  );
}
