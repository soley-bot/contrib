import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import { IconPlus, IconChevronRight } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import { generateInviteToken } from '@/lib/invite';
import type { Group } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/signup');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchGroups();
  }, [user]);

  async function fetchGroups() {
    const { data } = await supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('profile_id', user!.id);
    if (data) {
      setGroups(data.map((row: { group: unknown }) => row.group as Group).filter(Boolean));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!groupName.trim() || !subject.trim()) {
      setFormError('Group name and subject are required.');
      return;
    }
    setCreating(true);
    const token = generateInviteToken();
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), subject: subject.trim(), due_date: dueDate || null, lead_id: user!.id, invite_token: token })
      .select().single();

    if (error || !group) { setFormError(error?.message ?? 'Failed to create group.'); setCreating(false); return; }

    await supabase.from('group_members').insert({ group_id: group.id, profile_id: user!.id });
    await supabase.from('activity_log').insert({ group_id: group.id, actor_id: user!.id, action: 'member_joined', meta: {} });

    setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setCreating(false);
    router.push(`/group/${group.id}`);
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh text-[#57534E]">Loading…</div>;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} />

      {/* Desktop layout */}
      <div className="md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <span className="text-base font-semibold text-[#1C1917]">My Groups</span>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        {/* Content */}
        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {groups.length === 0 ? (
            <div className="text-center py-20 text-[#A8A29E]">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-sm">No groups yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/group/${group.id}`)}
                  className="bg-white border border-[#E7E5E4] rounded-[10px] p-4 flex items-center gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
                >
                  <div className="w-11 h-11 rounded-[10px] bg-[#EEF2FF] text-[#6366F1] font-bold text-base flex items-center justify-center flex-shrink-0">
                    {group.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1C1917] truncate">{group.name}</p>
                    <p className="text-xs text-[#A8A29E] mt-0.5">
                      {group.subject}{group.due_date ? ` · Due ${group.due_date}` : ''}
                    </p>
                  </div>
                  <IconChevronRight size={16} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-[#6366F1] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(99,102,241,.4)' }}
      >
        <IconPlus size={22} />
      </button>

      {/* New Group Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px]">
            <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
              <h2 className="text-base font-semibold text-[#1C1917]">New Group</h2>
              <button onClick={() => setShowModal(false)} className="text-[#57534E] hover:text-[#1C1917] p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Group name</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Business Strategy Final"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
