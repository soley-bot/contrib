import { useState, useEffect, useRef } from 'react';
import { IconClose } from '@/components/icons';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useToast } from '@/components/toast-provider';

interface EligibleMember {
  id: string;
  name: string;
  university: string;
}

interface AddMemberModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddMemberModal({ groupId, groupName, onClose, onAdded }: AddMemberModalProps) {
  const [members, setMembers] = useState<EligibleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const addingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  useFocusTrap(modalRef, onClose);

  useEffect(() => {
    async function fetchEligible() {
      try {
        const res = await fetch(`/api/groups/${groupId}/eligible-members`);
        if (!res.ok) throw new Error('Failed to fetch eligible members');
        const data = await res.json();
        setMembers(data.members ?? data);
      } catch {
        showToast('Failed to load eligible members', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchEligible();
  }, [groupId, showToast]);

  async function handleAdd(member: EligibleMember) {
    if (addingRef.current) return;
    addingRef.current = true;
    setAddingId(member.id);

    try {
      const res = await fetch(`/api/groups/${groupId}/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: member.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add member');
      }

      showToast(`Added ${member.name} to group`, 'success');
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      onAdded();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    } finally {
      setAddingId(null);
      addingRef.current = false;
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !addingId) onClose(); }}
    >
      <div ref={modalRef} className="w-full max-w-[440px] bg-white rounded-xl" role="dialog" aria-labelledby="add-member-title">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="add-member-title" className="text-base font-semibold text-text">Add member</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-[13px] text-text-secondary text-center py-6">No ungrouped students found</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-medium shrink-0">
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{member.name}</p>
                    <p className="text-[12px] text-text-tertiary truncate">{member.university}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(member)}
                    disabled={addingId === member.id}
                    className="h-8 px-3 text-[13px] font-medium rounded-md bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-60 shrink-0"
                  >
                    {addingId === member.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
