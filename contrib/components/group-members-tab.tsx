import InviteBanner from '@/components/invite-banner';
import MemberRow from '@/components/member-row';
import InlineTip from '@/components/inline-tip';
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
    </div>
  );
}
