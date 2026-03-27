import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import { IconAlertTriangle, IconLink, IconCheck } from '@/components/icons';
import type { Group } from '@/types';

export default function JoinPage() {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const [group, setGroup] = useState<Group | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not-found' | 'joining' | 'joined' | 'already' | 'full' | 'error'>('loading');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!userLoading && !user) {
      router.replace(`/signup?returnTo=/join/${token}`);
      return;
    }
    if (user && token) fetchGroup();
  }, [router.isReady, user, userLoading, token]);

  async function fetchGroup() {
    const res = await fetch(`/api/join/lookup?token=${encodeURIComponent(token as string)}`);
    if (!res.ok) { setStatus('not-found'); return; }
    const data = await res.json();

    setGroup(data);

    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', data.id)
      .eq('profile_id', user!.id)
      .single();

    if (existing) { setStatus('already'); return; }
    setStatus('found');
  }

  async function handleJoin() {
    if (!group || !user) return;
    setStatus('joining');

    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id);
    if ((count ?? 0) >= 6) {
      setStatus('full');
      return;
    }

    const { error: insertError } = await supabase.from('group_members').insert({
      group_id: group.id,
      profile_id: user.id,
    });

    if (insertError) { setJoinError(insertError.message); setStatus('error'); return; }

    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: user.id,
      action: 'member_joined',
      meta: {},
    });

    setStatus('joined');
    setTimeout(() => router.push(`/group/${group.id}`), 1200);
  }

  if (status === 'loading' || userLoading) {
    return <div className="flex items-center justify-center min-h-dvh text-muted">Loading…</div>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold">Failed to join</p>
        <p className="text-sm text-muted">{joinError}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconLink size={32} /></span>
        <p className="text-lg font-semibold">Invite link not found</p>
        <p className="text-sm text-muted">This invite link is invalid or has been removed.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'already' && group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-green"><IconCheck size={32} /></span>
        <p className="text-lg font-semibold">You&apos;re already a member</p>
        <p className="text-sm text-muted">{group.name}</p>
        <button onClick={() => router.push(`/group/${group.id}`)} className="mt-2 h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover">
          Open group
        </button>
      </div>
    );
  }

  if (status === 'full') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-text-tertiary">
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 24h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <p className="text-lg font-semibold text-text">This group is full</p>
        <p className="text-sm text-muted">This group already has 6 members and cannot accept new members.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'joined') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <span className="text-green"><IconCheck size={32} /></span>
        <p className="text-lg font-semibold text-green">Joined! Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5">
      <div className="bg-white border border-border rounded-xl p-6 max-w-sm w-full text-center shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-light text-brand font-bold text-xl flex items-center justify-center mx-auto mb-4">
          {group?.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-text mb-1">{group?.name}</h1>
        <p className="text-sm text-text-tertiary mb-6">{group?.subject}</p>
        <button
          onClick={handleJoin}
          disabled={status === 'joining'}
          className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
        >
          {status === 'joining' ? 'Joining…' : 'Join group'}
        </button>
      </div>
    </div>
  );
}
