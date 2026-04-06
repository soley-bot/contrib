import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import StudentNav from '@/components/student-nav';
import { useUser } from '@/hooks/use-user';
import TeacherModeSection from '@/components/teacher-mode-section';
import { requireAuth } from '@/lib/supabase-server';
import { useGroups } from '@/hooks/use-groups';
import { useProfile } from '@/hooks/use-profile';
import { useRoleLock } from '@/hooks/use-role-lock';
import { supabase } from '@/lib/supabase';
import { IconCopy, IconCheck } from '@/components/icons';
import InlineTip from '@/components/inline-tip';

type TelegramStatus = 'loading' | 'disconnected' | 'pending' | 'connected';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useUser();
  const { groups, loading: groupsLoading } = useGroups(user?.id);
  const { updateProfile, saving } = useProfile();
  const { locked: roleLocked, reason: lockReason } = useRoleLock(user?.id, profile?.role);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [error, setError] = useState('');

  const [tasksDone, setTasksDone] = useState(0);
  const [tasksAssigned, setTasksAssigned] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const [tgStatus, setTgStatus] = useState<TelegramStatus>('loading');
  const [tgCode, setTgCode] = useState('');
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [tgConnecting, setTgConnecting] = useState(false);
  const [tgDisconnecting, setTgDisconnecting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const countdownStartRef = useRef<number | null>(null);

  // Notification preferences
  const [notifyContributions, setNotifyContributions] = useState(true);
  const [notifyBlockers, setNotifyBlockers] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setUniversity(profile.university ?? '');
      setFaculty(profile.faculty ?? '');
      setYearOfStudy(profile.year_of_study ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    async function fetchTgStatus() {
      const { data } = await supabase
        .from('telegram_subscriptions')
        .select('verified, chat_id, verification_code, verification_expires_at, notify_contributions, notify_blockers, notify_deadlines, notify_weekly_digest')
        .eq('profile_id', user!.id)
        .maybeSingle();
      if (!data) { setTgStatus('disconnected'); return; }
      // Load notification preferences
      setNotifyContributions(data.notify_contributions ?? true);
      setNotifyBlockers(data.notify_blockers ?? true);
      setNotifyDeadlines(data.notify_deadlines ?? true);
      setNotifyWeeklyDigest(data.notify_weekly_digest ?? true);
      if (data.verified) { setTgStatus('connected'); return; }
      if (data.verification_code) {
        const expired = data.verification_expires_at && new Date(data.verification_expires_at) < new Date();
        if (expired) { setTgStatus('disconnected'); return; }
        setTgStatus('pending');
        return;
      }
      setTgStatus('disconnected');
    }
    fetchTgStatus();
  }, [user?.id]);

  async function handleTgConnect() {
    setTgConnecting(true);
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST' });
      const data = await res.json() as { code?: string; botUsername?: string; error?: string };
      if (res.ok && data.code) {
        setTgCode(data.code);
        setTgBotUsername(data.botUsername ?? '');
        countdownStartRef.current = Date.now();
        setCountdown(600);
        setTgStatus('pending');
      } else {
        setError(data.error ?? 'Failed to generate code. Try again.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    }
    setTgConnecting(false);
  }

  async function handleTgDisconnect() {
    setTgDisconnecting(true);
    try {
      const res = await fetch('/api/telegram/disconnect', { method: 'POST' });
      if (!res.ok) {
        setError('Failed to disconnect Telegram. Try again.');
        setTgDisconnecting(false);
        return;
      }
      setTgStatus('disconnected');
      setTgCode('');
    } catch {
      setError('Network error. Check your connection and try again.');
    }
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

  const handleCopyCode = useCallback(async () => {
    if (!tgCode) return;
    try {
      await navigator.clipboard.writeText(tgCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [tgCode]);

  // Countdown timer + auto-poll while pending
  useEffect(() => {
    if (tgStatus !== 'pending' || !user?.id) return;
    // Initialize countdown start time
    if (!countdownStartRef.current) countdownStartRef.current = Date.now();
    const startTime = countdownStartRef.current;
    const totalMs = 10 * 60 * 1000; // 10 minutes

    const tick = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setTgStatus('disconnected');
        setTgCode('');
        countdownStartRef.current = null;
      }
    }, 1000);

    // Poll for verification every 3 seconds
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('telegram_subscriptions')
        .select('verified')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (data?.verified) {
        setTgStatus('connected');
        countdownStartRef.current = null;
      }
    }, 3000);

    return () => { clearInterval(tick); clearInterval(poll); };
  }, [tgStatus, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    async function fetchStats() {
      const { data } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('assignee_id', user!.id)
        .is('deleted_at', null);
      const tasks = data ?? [];
      setTasksAssigned(tasks.length);
      setTasksDone(tasks.filter((t) => t.status === 'done').length);
      setStatsLoaded(true);
    }
    fetchStats();
  }, [user?.id]);

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    const err = await updateProfile(profile.id, name, university, profile.role, faculty, yearOfStudy);
    if (err) { setError(err); return; }
    refreshProfile();
    setEditing(false);
  }

  const ALLOWED_PREF_COLUMNS = ['notify_contributions', 'notify_blockers', 'notify_deadlines', 'notify_weekly_digest'];

  async function handleTogglePref(column: string, value: boolean) {
    if (!user?.id) return;
    if (!ALLOWED_PREF_COLUMNS.includes(column)) return;
    setPrefsSaving(true);
    const { error: err } = await supabase
      .from('telegram_subscriptions')
      .update({ [column]: value })
      .eq('profile_id', user.id);
    if (err) setError('Failed to update preference.');
    setPrefsSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  }
  if (!profile) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;

  const initials = profile.name?.slice(0, 2).toUpperCase() ?? '??';
  const isStudent = profile.role === 'student';
  const hasGroups = groups.length > 0;

  return (
    <div className="min-h-dvh bg-bg">
      <Head>
        <title>Profile — Contrib</title>
      </Head>
      <StudentNav profile={profile} onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center h-14 px-6 bg-white border-b border-border">
          <span className="text-base font-semibold text-text">Profile</span>
        </div>

        <div className="pt-16 md:pt-2 px-4 py-6 max-w-lg mx-auto">
          {/* Profile card */}
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            {/* Avatar + name row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full bg-brand text-white text-xl font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-text truncate">{profile.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {profile.university && <span className="text-sm text-text-secondary">{profile.university}</span>}
                  {profile.faculty && <><span className="text-[#CBD5E1]">·</span><span className="text-sm text-text-secondary">{profile.faculty}</span></>}
                  {profile.year_of_study && <><span className="text-[#CBD5E1]">·</span><span className="text-sm text-text-secondary">{profile.year_of_study}</span></>}
                </div>
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                  profile.role === 'teacher' ? 'bg-brand-light text-brand' : 'bg-[#F0FDF4] text-[#15803D]'
                }`}>
                  {profile.role}
                </span>
              </div>
            </div>

            {/* Edit form */}
            {editing ? (
              <div className="flex flex-col gap-3.5 border-t border-border pt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-text-secondary">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-text-secondary">University <span className="font-normal text-text-tertiary">(optional)</span></label>
                  <input type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-text-secondary">Faculty <span className="font-normal text-text-tertiary">(optional)</span></label>
                  <input type="text" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Business"
                    className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-text-secondary">Year of study <span className="font-normal text-text-tertiary">(optional)</span></label>
                  <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white">
                    <option value="">Select year…</option>
                    <option value="Year 1">Year 1</option>
                    <option value="Year 2">Year 2</option>
                    <option value="Year 3">Year 3</option>
                    <option value="Year 4">Year 4</option>
                    <option value="Year 5 or above">Year 5 or above</option>
                  </select>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2 pt-1 border-t border-border">
                  <button onClick={() => { setEditing(false); setError(''); }}
                    className="flex-1 h-11 border border-border text-text-secondary text-sm font-medium rounded-md hover:bg-bg-hover transition-colors">
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
                className="w-full h-10 border border-border bg-bg hover:bg-bg-hover text-text-secondary text-sm font-medium rounded-md transition-colors">
                Edit profile
              </button>
            )}
          </div>

          {/* Stats (student only) */}
          {isStudent && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Your stats</p>
              <div className="grid grid-cols-3 gap-2.5">
                {!statsLoaded ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-border rounded-xl px-3 py-3 text-center shadow-sm animate-pulse">
                      <div className="h-7 w-8 bg-border rounded mx-auto mb-1" />
                      <div className="h-3 w-16 bg-bg-hover rounded mx-auto" />
                    </div>
                  ))
                ) : (
                  [
                    { label: 'Groups joined', value: groups.length },
                    { label: 'Tasks done', value: tasksDone },
                    { label: 'Tasks assigned', value: tasksAssigned },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-border rounded-xl px-3 py-3 text-center shadow-sm">
                      <p className="text-2xl font-bold text-text">{s.value}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Telegram notifications */}
          {tgStatus === 'disconnected' && (
            <InlineTip id="profile-telegram">Connecting Telegram lets you receive task reminders and team notifications on your phone.</InlineTip>
          )}
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">Notifications</p>
            {tgStatus === 'disconnected' && (
              <div className="bg-[#EBF0FF] border-l-3 border-l-brand rounded-lg px-5 py-4 mb-3 flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5"><circle cx="8" cy="8" r="7" stroke="#1A56E8" strokeWidth="1.5"/><path d="M8 7v4" stroke="#1A56E8" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="5" r="0.75" fill="#1A56E8"/></svg>
                <p className="text-[13px] text-text-secondary">Connect Telegram to receive notifications about your group.</p>
              </div>
            )}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tgStatus === 'connected' ? 'bg-[#F0FDF4]' : 'bg-[#EBF0FF]'}`}>
                    {tgStatus === 'connected' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13" stroke="#1A56E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#1A56E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F172A]">Telegram</p>
                    <p className={`text-[12px] mt-0.5 ${tgStatus === 'connected' ? 'text-[#15803D]' : 'text-[#64748B]'}`}>
                      {tgStatus === 'loading' && 'Checking…'}
                      {tgStatus === 'disconnected' && 'Not connected'}
                      {tgStatus === 'pending' && 'Waiting for you to send the code…'}
                      {tgStatus === 'connected' && (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#15803D] flex-shrink-0" />
                          Connected to Telegram{tgBotUsername ? ` via @${tgBotUsername}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {tgStatus === 'connected' && (
                  <button
                    onClick={handleTgDisconnect}
                    disabled={tgDisconnecting}
                    className="text-[12px] text-[#94A3B8] hover:text-red-500 transition-colors whitespace-nowrap disabled:opacity-60"
                  >
                    {tgDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                )}
              </div>

              {tgStatus === 'disconnected' && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={handleTgConnect}
                    disabled={tgConnecting}
                    className="w-full h-10 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
                  >
                    {tgConnecting ? 'Generating code…' : 'Connect Telegram'}
                  </button>
                  <p className="text-[11px] text-[#94A3B8] text-center">
                    You will message <a href="https://t.me/contrib_notify_bot" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">@contrib_notify_bot</a> with a verification code
                  </p>
                </div>
              )}

              {tgStatus === 'pending' && tgCode && (
                <div className="mt-4 space-y-3">
                  <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-lg p-3">
                    <p className="text-[12px] text-[#475569] mb-2">
                      Open <a href={`https://t.me/${tgBotUsername}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">@{tgBotUsername}</a> in Telegram and send this code:
                    </p>
                    <div className="flex items-center justify-center gap-2 py-2">
                      <p className="text-2xl font-bold tracking-[0.2em] text-[#0F172A]">{tgCode}</p>
                      <button
                        onClick={handleCopyCode}
                        className="h-8 px-2 flex items-center gap-1 text-[12px] text-[#64748B] hover:text-brand border border-[#E2E8F0] rounded-md hover:bg-[#EBF0FF] transition-colors"
                        title="Copy code"
                      >
                        {codeCopied ? (
                          <>
                            <span className="text-[#15803D]"><IconCheck size={14} /></span>
                            <span className="text-[#15803D]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <IconCopy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] text-center">
                      Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')} · Checking automatically…
                    </p>
                  </div>
                  <button
                    onClick={handleTgDisconnect}
                    className="w-full h-10 border border-[#E2E8F0] text-[#94A3B8] text-sm rounded-md hover:bg-[#F1F5F9] hover:text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}

              {tgStatus === 'pending' && !tgCode && (
                <div className="mt-4 space-y-3">
                  <p className="text-[13px] text-[#475569]">
                    A code was already generated. Message <a href={`https://t.me/${tgBotUsername || 'contrib_notify_bot'}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">@{tgBotUsername || 'contrib_notify_bot'}</a> with your code — the page will update automatically.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTgConnect}
                      disabled={tgConnecting}
                      className="flex-1 h-10 border border-[#E2E8F0] text-[#475569] text-sm rounded-md hover:bg-[#F1F5F9] transition-colors disabled:opacity-60"
                    >
                      {tgConnecting ? '…' : 'New code'}
                    </button>
                    <button
                      onClick={handleTgDisconnect}
                      className="flex-1 h-10 border border-[#E2E8F0] text-[#94A3B8] text-sm rounded-md hover:bg-[#F1F5F9] hover:text-red-500 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

              {/* Notification preferences — only when connected */}
              {tgStatus === 'connected' && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">What to notify me about</p>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#E2E8F0] shadow-sm">
                    {([
                      { key: 'notify_contributions', label: 'Contributions', desc: 'Tasks created, completed, or reassigned', value: notifyContributions, setter: setNotifyContributions },
                      { key: 'notify_blockers', label: 'Heads Up', desc: 'When a teammate declares a blocker', value: notifyBlockers, setter: setNotifyBlockers },
                      { key: 'notify_deadlines', label: 'Deadlines', desc: 'Reminders 24h before a deadline', value: notifyDeadlines, setter: setNotifyDeadlines },
                      { key: 'notify_weekly_digest', label: 'Weekly digest', desc: 'Monday summary of group activity', value: notifyWeeklyDigest, setter: setNotifyWeeklyDigest },
                    ] as const).map((pref) => (
                      <label key={pref.key} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F8FAFF] transition-colors">
                        <div>
                          <p className="text-[13px] font-medium text-[#0F172A]">{pref.label}</p>
                          <p className="text-[11px] text-[#64748B] mt-0.5">{pref.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pref.value}
                          disabled={prefsSaving}
                          onClick={() => {
                            const next = !pref.value;
                            pref.setter(next);
                            handleTogglePref(pref.key, next);
                          }}
                          className={`relative inline-flex h-6 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${pref.value ? 'bg-brand' : 'bg-[#CBD5E1]'} ${prefsSaving ? 'opacity-60' : ''}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${pref.value ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              )}
          </div>
          {profile && (
            <div className="mt-6">
              <TeacherModeSection
                profile={profile}
                locked={roleLocked}
                lockReason={lockReason}
                onRoleChanged={refreshProfile}
              />
            </div>
          )}
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
