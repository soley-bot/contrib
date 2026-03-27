import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import Nav from '@/components/nav';
import { IconPlus, IconChevronRight } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { requireStudent } from '@/lib/supabase-server';
import { useGroups } from '@/hooks/use-groups';
import { supabase } from '@/lib/supabase';
import { generateInviteToken } from '@/lib/invite';
import { formatDueDate } from '@/lib/date';
import { useFocusTrap } from '@/hooks/use-focus-trap';

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
  const courseTokenRef = useRef<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeModal = () => { if (!creating) setShowModal(false); };
  useFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.newGroup === '1') {
      setShowModal(true);
      courseTokenRef.current = typeof router.query.courseToken === 'string' ? router.query.courseToken : null;
    }
  }, [router.isReady, router.query.newGroup, router.query.courseToken]);

  useEffect(() => {
    if (!loading && !user) router.replace('/signup');
    if (!loading && user && !profile) router.replace('/onboarding');
    if (!loading && profile && profile.role === 'teacher') router.replace('/teacher');
  }, [user, profile, loading, router]);

  async function handleCreate() {
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

    if (courseTokenRef.current) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('invite_token', courseTokenRef.current)
        .single();
      if (course) {
        await supabase.from('groups').update({ course_id: course.id }).eq('id', group.id);
      }
      courseTokenRef.current = null;
    }

    refreshGroups();
    setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setCreating(false);
    router.push(`/group/${group.id}`);
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;

  return (
    <div className="min-h-dvh bg-bg">
      <Nav profile={profile} />

      {/* Desktop layout */}
      <div className="md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-border">
          <div>
            <span className="text-base font-semibold text-text">My Groups</span>
            {profile?.name && (
              <span className="ml-2 text-sm text-text-tertiary">— {getGreeting()}, {profile.name.split(' ')[0]}</span>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        {/* Content */}
        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {groupsLoading ? (
            <div className="flex flex-col gap-2.5 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3.5 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-border" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-border rounded mb-2" />
                    <div className="h-3 w-20 bg-bg-hover rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-14">
              <svg viewBox="0 0 200 140" fill="none" className="w-48 mx-auto mb-5">
                <ellipse cx="100" cy="128" rx="72" ry="8" fill="#F1F5F9"/>
                {/* desk */}
                <rect x="30" y="88" width="140" height="8" rx="4" fill="#E2E8F0"/>
                <rect x="44" y="96" width="6" height="28" rx="3" fill="#CBD5E1"/>
                <rect x="150" y="96" width="6" height="28" rx="3" fill="#CBD5E1"/>
                {/* laptop */}
                <rect x="60" y="56" width="80" height="52" rx="6" fill="#0F172A"/>
                <rect x="64" y="60" width="72" height="44" rx="4" fill="#1E293B"/>
                <rect x="67" y="63" width="66" height="38" rx="2" fill="#F8FAFF"/>
                {/* screen content */}
                <rect x="72" y="68" width="32" height="5" rx="2" fill="#1A56E8"/>
                <rect x="72" y="76" width="24" height="3" rx="1.5" fill="#E2E8F0"/>
                <rect x="72" y="82" width="28" height="3" rx="1.5" fill="#E2E8F0"/>
                <rect x="110" y="68" width="16" height="16" rx="3" fill="#EBF0FF"/>
                <path d="M114 76l2.5 2.5 4-4" stroke="#1A56E8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* laptop base */}
                <rect x="50" y="108" width="100" height="4" rx="2" fill="#1E293B"/>
                {/* person left */}
                <circle cx="52" cy="58" r="12" fill="#EBF0FF"/>
                <circle cx="52" cy="52" r="6" fill="#93B4FF"/>
                <rect x="42" y="66" width="20" height="14" rx="5" fill="#1A56E8"/>
                {/* person right */}
                <circle cx="148" cy="58" r="12" fill="#EBF0FF"/>
                <circle cx="148" cy="52" r="6" fill="#93B4FF"/>
                <rect x="138" y="66" width="20" height="14" rx="5" fill="#1240C4"/>
                {/* speech bubble */}
                <rect x="155" y="34" width="34" height="18" rx="6" fill="#1A56E8"/>
                <path d="M158 52l-4 4 8-1z" fill="#1A56E8"/>
                <rect x="160" y="39" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.8"/>
                <rect x="160" y="45" width="16" height="3" rx="1.5" fill="white" fillOpacity="0.6"/>
              </svg>
              <p className="text-[16px] font-bold text-text mb-1.5">No groups yet</p>
              <p className="text-sm text-text-tertiary mb-6 max-w-xs mx-auto">Create your first group and invite your teammates — every contribution gets tracked.</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 h-11 px-6 bg-brand hover:bg-brand-hover text-white text-[14px] font-medium rounded-md transition-colors"
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
                  className="bg-white border border-border rounded-xl p-4 flex items-center gap-3.5 cursor-pointer hover:border-brand transition-colors shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-light text-brand font-bold text-base flex items-center justify-center flex-shrink-0">
                    {group.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text truncate">{group.name}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {group.subject}{group.due_date ? ` · Due ${formatDueDate(group.due_date)}` : ''}
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
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-brand text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(26,86,232,.25)' }}
      >
        <IconPlus size={22} />
      </button>

      {/* New Group Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div ref={modalRef} className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">New Group</h2>
              <button type="button" onClick={() => { if (!creating) setShowModal(false); }} className="p-1 text-text-secondary hover:text-text transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label htmlFor="group-name" className="text-[13px] font-medium text-text-secondary">Group name</label>
                <input id="group-name" type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Business Strategy Final"
                  aria-describedby="group-form-error"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="group-subject" className="text-[13px] font-medium text-text-secondary">Subject code</label>
                <input id="group-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  aria-describedby="group-form-error"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="group-due-date" className="text-[13px] font-medium text-text-secondary">Due date <span className="font-normal text-text-tertiary">(optional)</span></label>
                <input id="group-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {formError && <p id="group-form-error" role="alert" className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-border">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireStudent(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
