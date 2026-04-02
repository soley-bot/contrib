import { useState, useRef } from 'react';
import { IconClose } from '@/components/icons';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useToast } from '@/components/toast-provider';

interface AssignGroupModalProps {
  student: { id: string; name: string };
  groups: { id: string; name: string; memberCount: number }[];
  onClose: () => void;
  onAssigned: () => void;
}

const MAX_GROUP_SIZE = 6;

export default function AssignGroupModal({ student, groups, onClose, onAssigned }: AssignGroupModalProps) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const assigningRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  useFocusTrap(modalRef, onClose);

  async function handleAssign(group: { id: string; name: string }) {
    if (assigningRef.current) return;
    assigningRef.current = true;
    setAssigningId(group.id);

    try {
      const res = await fetch(`/api/groups/${group.id}/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: student.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to assign student');
      }

      showToast(`Assigned ${student.name} to ${group.name}`, 'success');
      onAssigned();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign student', 'error');
    } finally {
      setAssigningId(null);
      assigningRef.current = false;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !assigningId) onClose(); }}
    >
      <div ref={modalRef} className="w-full max-w-[440px] bg-white rounded-xl" role="dialog" aria-labelledby="assign-group-title">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="assign-group-title" className="text-base font-semibold text-text">Assign {student.name}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-2">
          {groups.length === 0 ? (
            <p className="text-[13px] text-text-secondary text-center py-6">No groups available</p>
          ) : (
            groups.map((group) => {
              const isFull = group.memberCount >= MAX_GROUP_SIZE;
              return (
                <div key={group.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{group.name}</p>
                  </div>
                  <span className="text-[12px] text-text-tertiary shrink-0">
                    {group.memberCount} of {MAX_GROUP_SIZE} members
                  </span>
                  {isFull ? (
                    <span className="h-8 px-3 text-[13px] font-medium rounded-md bg-gray-100 text-text-tertiary flex items-center shrink-0">
                      Full
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAssign(group)}
                      disabled={assigningId === group.id}
                      className="h-8 px-3 text-[13px] font-medium rounded-md bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-60 shrink-0"
                    >
                      {assigningId === group.id ? 'Assigning...' : 'Assign'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
