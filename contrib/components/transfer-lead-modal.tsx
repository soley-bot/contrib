import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IconClose, IconCheck } from '@/components/icons';
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

  if (others.length === 0) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[400px] bg-white rounded-[12px] p-5">
          <p className="text-sm text-[#57534E]">No other members to transfer lead to.</p>
          <button onClick={onClose} className="mt-4 w-full h-10 border border-[#E7E5E4] rounded-md text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  async function handleTransfer() {
    if (!newLeadId) return;
    setSaving(true);
    const newLeadMember = others.find((m) => m.profile_id === newLeadId);

    await supabase.from('groups').update({ lead_id: newLeadId }).eq('id', group.id);

    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: userId,
      action: 'lead_transferred',
      task_id: null,
      meta: { to_name: newLeadMember?.profile?.name ?? '' },
    });

    setSaving(false);
    onUpdated();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[400px] bg-white rounded-[12px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
          <h2 className="text-base font-semibold text-[#1C1917]">Transfer lead</h2>
          <button onClick={onClose} className="text-[#57534E] hover:text-[#1C1917] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5">
          <label className="text-[13px] font-medium text-[#57534E] mb-1.5 block">Select new lead</label>
          <select
            value={newLeadId}
            onChange={(e) => setNewLeadId(e.target.value)}
            className="w-full border border-[#E7E5E4] rounded-md px-3 py-2 text-sm text-[#1C1917] focus:border-[#FF5841] outline-none bg-white"
          >
            {others.map((m) => (
              <option key={m.profile_id} value={m.profile_id}>{m.profile?.name ?? m.profile_id}</option>
            ))}
          </select>
          <p className="text-xs text-[#A8A29E] mt-2">You will become a regular member after this change.</p>
        </div>
        <div className="px-5 py-3 border-t border-[#E7E5E4]">
          <button
            onClick={handleTransfer}
            disabled={saving || !newLeadId}
            className="w-full h-11 bg-[#FF5841] hover:bg-[#E04030] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Transferring…' : <><IconCheck size={14} /> Transfer lead</>}
          </button>
        </div>
      </div>
    </div>
  );
}
