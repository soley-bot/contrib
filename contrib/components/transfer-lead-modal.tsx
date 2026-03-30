import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
import { useToast } from '@/components/toast-provider';
import type { Group, GroupMember } from '@/types';

interface TransferLeadModalProps {
  group: Group;
  members: GroupMember[];
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TransferLeadModal({ group, members, userId, onClose, onUpdated }: TransferLeadModalProps) {
  const others = members.filter((m) => m.profile_id !== userId);
  const [newLeadId, setNewLeadId] = useState(others[0]?.profile_id ?? '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  if (others.length === 0) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[400px] bg-white rounded-xl p-5">
          <p className="text-sm text-[#475569]">No other members to transfer lead to.</p>
          <button onClick={onClose} className="mt-4 w-full h-10 border border-[#E2E8F0] rounded-md text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  async function handleTransfer() {
    if (saving) return;
    if (!newLeadId) return;
    setSaving(true);
    const newLeadMember = others.find((m) => m.profile_id === newLeadId);

    const { error: updateError } = await supabase.from('groups').update({ lead_id: newLeadId }).eq('id', group.id);
    if (updateError) { setSaving(false); showToast('Failed to transfer lead. Please try again.'); return; }

    const { error: logError } = await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: userId,
      action: 'lead_transferred',
      task_id: null,
      meta: { to_name: newLeadMember?.profile?.name ?? '' },
    });
    if (logError) { setSaving(false); showToast('Failed to transfer lead. Please try again.'); return; }

    setSaving(false);
    onUpdated();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Transfer group lead" className="w-full max-w-[400px] bg-white rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-semibold text-[#0F172A]">Transfer lead</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#475569] hover:text-[#0F172A] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleTransfer(); }}>
        <div className="p-5">
          <label htmlFor="transfer-lead-select" className="text-[13px] font-medium text-[#475569] mb-1.5 block">Select new lead</label>
          <select
            id="transfer-lead-select"
            value={newLeadId}
            onChange={(e) => setNewLeadId(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] focus:border-brand outline-none bg-white"
          >
            {others.map((m) => (
              <option key={m.profile_id} value={m.profile_id}>{m.profile?.name ?? m.profile_id}</option>
            ))}
          </select>
          <p className="text-xs text-[#94A3B8] mt-2">You will become a regular member after this change.</p>
        </div>
        <div className="px-5 py-3 border-t border-[#E2E8F0]">
          <button
            type="submit"
            disabled={saving || !newLeadId}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Transferring…' : <><IconCheck size={14} /> Transfer lead</>}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
