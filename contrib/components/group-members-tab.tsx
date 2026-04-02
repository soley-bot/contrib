import { useState } from 'react';
import InviteBanner from '@/components/invite-banner';
import MemberRow from '@/components/member-row';
import InlineTip from '@/components/inline-tip';
import AddMemberModal from '@/components/add-member-modal';
import { IconPlus } from '@/components/icons';
import type { Task, GroupMember, Group } from '@/types';

interface GroupMembersTabProps {
  group: Group;
  members: GroupMember[];
  tasks: Task[];
  isLead: boolean;
  userId: string;
  onRemoveMember: (member: GroupMember) => void;
  onTransferLead: () => void;
  onDeleteGroup: () => void;
  onLeaveGroup: () => void;
  onRefreshGroup: () => void;
}

export default function GroupMembersTab({
  group, members, tasks, isLead, userId,
  onRemoveMember, onTransferLead, onDeleteGroup, onLeaveGroup, onRefreshGroup,
}: GroupMembersTabProps) {
  const [showAddMember, setShowAddMember] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
      {members.length < 6 && (
        <InviteBanner
          token={group.invite_token}
          onReset={isLead ? async () => {
            const res = await fetch(`/api/groups/${group.id}/reset-invite`, { method: 'POST' });
            if (res.ok) onRefreshGroup();
          } : undefined}
        />
      )}
      {isLead && group.course_id && members.length < 6 && (
        <button
          onClick={() => setShowAddMember(true)}
          className="w-full h-9 border border-brand text-brand text-[13px] font-medium rounded-md hover:bg-brand-light transition-colors flex items-center justify-center gap-1.5"
        >
          <IconPlus size={14} /> Add from course
        </button>
      )}
      <InlineTip id="members-invite">Share the invite link above to add teammates. Groups can have up to 6 members.</InlineTip>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
        {members.length} member{members.length !== 1 ? 's' : ''}
      </p>
      {members.map((m) => (
        <MemberRow key={m.id} member={m} tasks={tasks}
          isThisMemberLead={m.profile_id === group.lead_id}
          canRemove={isLead && m.profile_id !== userId}
          onRemove={() => onRemoveMember(m)}
        />
      ))}

      {/* Group management hint */}
      <p className="mt-4 text-center text-[12px] text-text-tertiary">
        Use the menu (<span className="inline-block align-middle">&#8942;</span>) in the header to manage this group.
      </p>

      {showAddMember && group.course_id && (
        <AddMemberModal
          groupId={group.id}
          groupName={group.name}
          onClose={() => setShowAddMember(false)}
          onAdded={() => { setShowAddMember(false); onRefreshGroup(); }}
        />
      )}
    </div>
  );
}
