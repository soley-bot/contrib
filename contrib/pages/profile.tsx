import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import Nav from '@/components/nav';
import RoleToggle from '@/components/role-toggle';
import { useUser } from '@/hooks/use-user';
import { requireAuth } from '@/lib/supabase-server';
import { useGroups } from '@/hooks/use-groups';
import { useProfile } from '@/hooks/use-profile';
import { useRoleLock } from '@/hooks/use-role-lock';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

type TelegramStatus = 'loading' | 'disconnected' | 'pending' | 'connected';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useUser();
  const { groups, loading: groupsLoading } = useGroups(user?.id);
  const { updateProfile, saving } = useProfile();
  const { locked: roleLocked, reason: lockReason, loading: lockLoading } = useRoleLock(user?.id, profile?.role);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');

  const [tasksDone, setTasksDone] = useState(0);
  const [tasksAssigned, setTasksAssigned] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const [tgStatus, setTgStatus] = useState<TelegramStatus>('loading');
  const [tgCode, setTgCode] = useState('');
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [tgConnecting, setTgConnecting] = useState(false);
  const [tgDisconnecting, setTgDisconnecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setUniversity(profile.university ?? '');
      setFaculty(profile.faculty ?? '');
      setYearOfStudy(profile.year_of_study ?? '');
      setRole(profile.role ?? 'student');
    }
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('telegram_subscriptions')
      .select('verified, chat_id, verification_code')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setTgStatus('disconnected'); return; }
        if (data.verified) { setTgStatus('connected'); return; }
        if (data.verification_code) { setTgStatus('pending'); return; }
        setTgStatus('disconnected');
      });
  }, [user?.id]);

  async function handleTgConnect() {
    setTgConnecting(true);
    const res = await fetch('/api/telegram/connect', { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { code: string; botUsername: string };
      setTgCode(data.code);
      setTgBotUsername(data.botUsername);
      setTgStatus('pending');
    }
    setTgConnecting(false);
  }

  async function handleTgDisconnect() {
    setTgDisconnecting(true);
    await fetch('/api/telegram/disconnect', { method: 'POST' });
    setTgStatus('disconnected');
    setTgCode('');
    setTgDisconnecting(false);
  }

  async function handleTgCheckStatus() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('telegram_subscriptions')
      .select('verified')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (data?.verified) setTgStatus('connected');
  }

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('tasks')
      .select('id, status')
      .eq('assignee_id', user.id)
      .is('deleted_at', null)
      .then(({ data }) => {
        const tasks = data ?? [];
        setTasksAssigned(tasks.length);
        setTasksDone(tasks.filter((t) => t.status === 'done').length);
        setStatsLoaded(true);
      });
  }, [user?.id]);

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    const err = await updateProfile(profile.id, name, university, role, faculty, yearOfStudy);
    if (err) { setError(err); return; }
    refreshProfile();
    setEditing(false);
    if (role !== profile.role) {
      router.push(role === 'teacher' ? '/teacher' : '/dashboard');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  }
  if (!profile) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;

  const initials = profile.name?.slice(0, 2).toUpperCase() ?? '??';
  const isStudent = profile.role === 'student';
  const hasGroups = groups.length > 0;

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <Nav profile={profile} onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center h-14 px-6 bg-white border-b border-[#E2E8F0]">
          <span className="text-base font-semibold text-[#0F172A]">Profile</span>
        </div>

        <div className="pt-14 md:pt-0 px-4 py-6 max-w-lg mx-auto">
          {/* Profile card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
            {/* Avatar + name row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full bg-brand text-white text-xl font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-[#0F172A] truncate">{profile.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {profile.university && <span className="text-sm text-[#475569]">{profile.university}</span>}
                  {profile.faculty && <><span className="text-[#CBD5E1]">·</span><span className="text-sm text-[#475569]">{profile.faculty}</span></>}
                  {profile.year_of_study && <><span className="text-[#CBD5E1]">·</span><span className="text-sm text-[#475569]">{profile.year_of_study}</span></>}
                </div>
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                  profile.role === 'teacher' ? 'bg-[#EBF0FF] text-[#1A56E8]' : 'bg-[#F0FDF4] text-[#15803D]'
                }`}>
                  {profile.role}
                </span>
              </div>
            </div>

            {/* Edit form */}
            {editing ? (
              <div className="flex flex-col gap-3.5 border-t border-[#E2E8F0] pt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-[#475569]">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-[#475569]">University <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                  <input type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-[#475569]">Faculty <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                  <input type="text" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Business"
                    className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-[#475569]">Year of study <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                  <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white">
                    <option value="">Select year…</option>
                    <option value="Year 1">Year 1</option>
                    <option value="Year 2">Year 2</option>
                    <option value="Year 3">Year 3</option>
                    <option value="Year 4">Year 4</option>
                    <option value="Year 5+">Year 5+</option>
                  </select>
                </div>
                {!lockLoading && roleLocked ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-[#475569]">Role</label>
                    <div className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] text-[#0F172A] bg-[#F8FAFF]">
                      {profile.role === 'teacher' ? 'Teacher' : 'Student'}
                    </div>
                    <p className="text-[12px] text-[#64748B] leading-snug">
                      Your role is locked because you have active {lockReason === 'courses' ? 'courses' : 'groups'}. Contact support to change it.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0">
                    <RoleToggle value={role} onChange={setRole} />
                    {role !== profile.role && (
                      <p className="text-[12px] text-[#D97706] bg-[#FEF3C7] rounded px-2 py-1.5 mt-1.5 leading-snug">
                        Switching to {role === 'teacher' ? 'teacher' : 'student'} will change your dashboard and features. This can be changed until you create your first {role === 'teacher' ? 'course' : 'group'}.
                      </p>
                    )}
                  </div>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2 pt-1 border-t border-[#E2E8F0]">
                  <button onClick={() => { setEditing(false); setError(''); }}
                    className="flex-1 h-11 border border-[#E2E8F0] text-[#475569] text-sm font-medium rounded-md hover:bg-[#F1F5F9] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditing(true)}
                className="w-full h-10 border border-[#E2E8F0] bg-[#F8FAFF] hover:bg-[#F1F5F9] text-[#475569] text-sm font-medium rounded-md transition-colors">
                Edit profile
              </button>
            )}
          </div>

          {/* Stats (student only) */}
          {isStudent && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2.5">Your stats</p>
              <div className="grid grid-cols-3 gap-2.5">
                {!statsLoaded ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-3 text-center shadow-sm animate-pulse">
                      <div className="h-7 w-8 bg-[#E2E8F0] rounded mx-auto mb-1" />
                      <div className="h-3 w-16 bg-[#F1F5F9] rounded mx-auto" />
                    </div>
                  ))
                ) : (
                  [
                    { label: 'Groups joined', value: groups.length },
                    { label: 'Tasks done', value: tasksDone },
                    { label: 'Tasks assigned', value: tasksAssigned },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-3 text-center shadow-sm">
                      <p className="text-2xl font-bold text-[#0F172A]">{s.value}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Telegram notifications */}
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2.5">Notifications</p>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EBF0FF] flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="#1A56E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#1A56E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F172A]">Telegram</p>
                    <p className="text-[12px] text-[#64748B] mt-0.5">
                      {tgStatus === 'loading' && 'Checking…'}
                      {tgStatus === 'disconnected' && 'Get notified when teammates log work or declare blockers'}
                      {tgStatus === 'pending' && 'Waiting for verification…'}
                      {tgStatus === 'connected' && 'Connected — you will receive group notifications'}
                    </p>
                  </div>
                </div>
                {tgStatus === 'connected' && (
                  <button
                    onClick={handleTgDisconnect}
                    disabled={tgDisconnecting}
                    className="text-[12px] text-[#64748B] hover:text-red-500 transition-colors whitespace-nowrap disabled:opacity-60"
                  >
                    {tgDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                )}
              </div>

              {tgStatus === 'disconnected' && (
                <button
                  onClick={handleTgConnect}
                  disabled={tgConnecting}
                  className="mt-4 w-full h-10 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
                >
                  {tgConnecting ? 'Generating code…' : 'Connect Telegram'}
                </button>
              )}

              {tgStatus === 'pending' && tgCode && (
                <div className="mt-4 space-y-3">
                  <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-lg p-3">
                    <p className="text-[12px] text-[#475569] mb-2">
                      Open Telegram and message <span className="font-semibold text-[#0F172A]">@{tgBotUsername}</span> with this code:
                    </p>
                    <p className="text-2xl font-bold tracking-[0.2em] text-[#0F172A] text-center py-1">{tgCode}</p>
                    <p className="text-[11px] text-[#94A3B8] text-center mt-1">Expires in 10 minutes</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTgCheckStatus}
                      className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors"
                    >
                      I sent it — check status
                    </button>
                    <button
                      onClick={handleTgDisconnect}
                      className="h-10 px-4 border border-[#E2E8F0] text-[#475569] text-sm rounded-md hover:bg-[#F1F5F9] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {tgStatus === 'pending' && !tgCode && (
                <div className="mt-4 space-y-3">
                  <p className="text-[13px] text-[#475569]">
                    A verification code was already sent. Message <span className="font-semibold">@{tgBotUsername || 'ContribBot'}</span> with your code, then check status below.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTgCheckStatus}
                      className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors"
                    >
                      Check status
                    </button>
                    <button
                      onClick={handleTgConnect}
                      disabled={tgConnecting}
                      className="h-10 px-4 border border-[#E2E8F0] text-[#475569] text-sm rounded-md hover:bg-[#F1F5F9] transition-colors disabled:opacity-60"
                    >
                      {tgConnecting ? '…' : 'New code'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireAuth(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
