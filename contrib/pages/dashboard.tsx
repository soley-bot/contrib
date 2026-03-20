import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import { IconPlus, IconChevronRight } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useGroups } from '@/hooks/use-groups';
import { supabase } from '@/lib/supabase';
import { generateInviteToken } from '@/lib/invite';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useGroups(user?.id);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/signup');
    if (!loading && profile && profile.role === 'teacher') router.replace('/teacher');
  }, [user, profile, loading, router]);

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

    const { error: joinError } = await supabase.from('group_members').insert({ group_id: group.id, profile_id: user!.id });
    if (joinError) { setFormError(joinError.message); setCreating(false); return; }

    await supabase.from('activity_log').insert({ group_id: group.id, actor_id: user!.id, action: 'member_joined', meta: {} });

    refreshGroups();
    setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setCreating(false);
    router.push(`/group/${group.id}`);
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} />

      {/* Desktop layout */}
      <div className="md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div>
            <span className="text-base font-semibold text-[#1C1917]">My Groups</span>
            {profile?.name && (
              <span className="ml-2 text-sm text-[#A8A29E]">— {getGreeting()}, {profile.name.split(' ')[0]}</span>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-[#FF5841] hover:bg-[#E04030] text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        {/* Content */}
        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {!groupsLoading && groups.length === 0 ? (
            <div className="text-center py-14">
              <svg viewBox="0 0 200 140" fill="none" className="w-48 mx-auto mb-5">
                <ellipse cx="100" cy="128" rx="72" ry="8" fill="#F5F5F4"/>
                {/* desk */}
                <rect x="30" y="88" width="140" height="8" rx="4" fill="#E7E5E4"/>
                <rect x="44" y="96" width="6" height="28" rx="3" fill="#D6D3D1"/>
                <rect x="150" y="96" width="6" height="28" rx="3" fill="#D6D3D1"/>
                {/* laptop */}
                <rect x="60" y="56" width="80" height="52" rx="6" fill="#1C1917"/>
                <rect x="64" y="60" width="72" height="44" rx="4" fill="#3A3632"/>
                <rect x="67" y="63" width="66" height="38" rx="2" fill="#FAFAF9"/>
                {/* screen content */}
                <rect x="72" y="68" width="32" height="5" rx="2" fill="#FF5841"/>
                <rect x="72" y="76" width="24" height="3" rx="1.5" fill="#E7E5E4"/>
                <rect x="72" y="82" width="28" height="3" rx="1.5" fill="#E7E5E4"/>
                <rect x="110" y="68" width="16" height="16" rx="3" fill="#FFF0EE"/>
                <path d="M114 76l2.5 2.5 4-4" stroke="#FF5841" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* laptop base */}
                <rect x="50" y="108" width="100" height="4" rx="2" fill="#2C2927"/>
                {/* person left */}
                <circle cx="52" cy="58" r="12" fill="#FFF0EE"/>
                <circle cx="52" cy="52" r="6" fill="#FFCFC9"/>
                <rect x="42" y="66" width="20" height="14" rx="5" fill="#FF5841"/>
                {/* person right */}
                <circle cx="148" cy="58" r="12" fill="#E0F2FE"/>
                <circle cx="148" cy="52" r="6" fill="#BAE6FD"/>
                <rect x="138" y="66" width="20" height="14" rx="5" fill="#0E7490"/>
                {/* speech bubble */}
                <rect x="155" y="34" width="34" height="18" rx="6" fill="#FF5841"/>
                <path d="M158 52l-4 4 8-1z" fill="#FF5841"/>
                <rect x="160" y="39" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.8"/>
                <rect x="160" y="45" width="16" height="3" rx="1.5" fill="white" fillOpacity="0.6"/>
              </svg>
              <p className="text-[16px] font-bold text-[#1C1917] mb-1.5">No groups yet</p>
              <p className="text-sm text-[#A8A29E] mb-6 max-w-xs mx-auto">Create your first group and invite your teammates — every contribution gets tracked.</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 h-11 px-6 bg-[#FF5841] hover:bg-[#E04030] text-white text-[14px] font-medium rounded-md transition-colors"
              >
                <IconPlus size={16} /> Create your first group
              </button>
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
                  <div className="w-11 h-11 rounded-[10px] bg-[#FFF0EE] text-[#FF5841] font-bold text-base flex items-center justify-center flex-shrink-0">
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
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-[#FF5841] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(255,88,65,.4)' }}
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
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-[#FF5841] hover:bg-[#E04030] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
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
