import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { createClient } from '@supabase/supabase-js';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import { IconAlertTriangle, IconLink, IconCheck } from '@/components/icons';
import type { Group } from '@/types';

interface PageProps {
  group: (Pick<Group, 'id' | 'name' | 'subject' | 'lead_id'> & { memberCount: number }) | null;
}

export default function JoinPage({ group }: PageProps) {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const [status, setStatus] = useState<'idle' | 'already' | 'full' | 'joining' | 'joined' | 'error'>('idle');
  const [joinError, setJoinError] = useState('');

  // Once user loads, check if already a member
  useEffect(() => {
    if (!group || userLoading || !user) return;
    supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('profile_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setStatus('already');
      });
  }, [group, user, userLoading]);

  async function handleJoin() {
    if (!group || !user) return;
    setStatus('joining');

    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id);
    if ((count ?? 0) >= 6) { setStatus('full'); return; }

    const { error: insertError } = await supabase.from('group_members').insert({
      group_id: group.id,
      profile_id: user.id,
    });
    if (insertError) { setJoinError(insertError.message); setStatus('error'); return; }

    supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: user.id,
      action: 'member_joined',
      meta: {},
    }).then(null, () => {});

    setStatus('joined');

    if (group.lead_id && group.lead_id !== user.id) {
      (async () => {
        const { data: joinerProfile } = await supabase
          .from('profiles').select('name').eq('id', user.id).single();
        supabase.from('notifications').insert({
          recipient_id: group.lead_id!,
          group_id: group.id,
          type: 'member_joined',
          title: `${joinerProfile?.name ?? 'Someone'} joined your group`,
          meta: { memberName: joinerProfile?.name ?? null, groupName: group.name },
        }).then(null, () => {});
      })();
    }
    setTimeout(() => router.push(`/group/${group.id}`), 1200);
  }

  // Not found
  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconLink size={32} /></span>
        <p className="text-lg font-semibold">Invite link not found</p>
        <p className="text-sm text-muted">This link is no longer valid. Ask your group lead for a new invite link.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold">Failed to join</p>
        <p className="text-sm text-muted">{joinError}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
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
        <button onClick={() => router.push('/dashboard')} className="mt-2 h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover">Back to dashboard</button>
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

  if (status === 'already') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-green"><IconCheck size={32} /></span>
        <p className="text-lg font-semibold">You&apos;re already a member</p>
        <p className="text-sm text-muted">{group.name}</p>
        <button onClick={() => router.push(`/group/${group.id}`)} className="mt-2 h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover">Open group</button>
      </div>
    );
  }

  const memberCount = group.memberCount ?? 0;
  const maxMembers = 6;

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5">
      <div className="bg-white border border-border rounded-xl p-6 max-w-sm w-full text-center shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-light text-brand font-bold text-xl flex items-center justify-center mx-auto mb-4">
          {group.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-text mb-1">{group.name}</h1>
        <p className="text-sm text-text-tertiary mb-3">{group.subject}</p>

        {/* Member count */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex gap-1">
            {Array.from({ length: maxMembers }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < memberCount ? 'bg-brand' : 'bg-border'}`}
              />
            ))}
          </div>
          <span className="text-[12px] text-text-secondary">{memberCount} / {maxMembers} members</span>
        </div>

        {/* CTA — depends on auth state */}
        {userLoading ? (
          <div className="w-full h-11 bg-border rounded-md animate-pulse" />
        ) : !user ? (
          <>
            <button
              onClick={() => router.push(`/signup?returnTo=/join/${token}`)}
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors mb-2"
            >
              Sign up to join
            </button>
            <p className="text-[12px] text-text-tertiary">
              Already have an account?{' '}
              <button onClick={() => router.push(`/login?returnTo=/join/${token}`)} className="text-brand font-medium hover:underline">Log in</button>
            </p>
          </>
        ) : (
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
          >
            {status === 'joining' ? 'Joining…' : 'Join group'}
          </button>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = ctx.params?.token;
  if (typeof token !== 'string') return { props: { group: null } };

  // Use service role to bypass RLS — only reading public fields
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: group } = await admin
    .from('groups')
    .select('id, name, subject, lead_id')
    .eq('invite_token', token)
    .single();

  if (!group) return { props: { group: null } };

  const { count: memberCount } = await admin
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id);

  return {
    props: {
      group: { ...group, memberCount: memberCount ?? 0 },
    },
  };
}
