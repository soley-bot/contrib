import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types';

export default function JoinPage() {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const [group, setGroup] = useState<Group | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not-found' | 'joining' | 'joined' | 'already' | 'error'>('loading');
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
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (!data) { setStatus('not-found'); return; }
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
    return <div className="flex items-center justify-center min-h-dvh text-[#6B7280]">Loading…</div>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <p className="text-3xl">⚠️</p>
        <p className="text-lg font-semibold">Failed to join</p>
        <p className="text-sm text-[#6B7280]">{joinError}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-[#6366F1] text-sm font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <p className="text-3xl">🔗</p>
        <p className="text-lg font-semibold">Invite link not found</p>
        <p className="text-sm text-[#6B7280]">This invite link is invalid or has been removed.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-[#6366F1] text-sm font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'already' && group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <p className="text-3xl">✅</p>
        <p className="text-lg font-semibold">You&apos;re already a member</p>
        <p className="text-sm text-[#6B7280]">{group.name}</p>
        <button onClick={() => router.push(`/group/${group.id}`)} className="mt-2 h-10 px-5 bg-[#6366F1] text-white text-sm font-medium rounded-md hover:bg-[#4F46E5]">
          Open group
        </button>
      </div>
    );
  }

  if (status === 'joined') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <p className="text-3xl">🎉</p>
        <p className="text-lg font-semibold text-[#22C55E]">Joined! Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5">
      <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-6 max-w-sm w-full text-center shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] text-[#6366F1] font-bold text-xl flex items-center justify-center mx-auto mb-4">
          {group?.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-[#111827] mb-1">{group?.name}</h1>
        <p className="text-sm text-[#9CA3AF] mb-6">{group?.subject}</p>
        <button
          onClick={handleJoin}
          disabled={status === 'joining'}
          className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
        >
          {status === 'joining' ? 'Joining…' : 'Join group'}
        </button>
      </div>
    </div>
  );
}
