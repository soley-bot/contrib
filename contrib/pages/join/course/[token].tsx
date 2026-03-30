import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { createClient } from '@supabase/supabase-js';
import { useUser } from '@/hooks/use-user';
import { useGroups } from '@/hooks/use-groups';
import { supabase } from '@/lib/supabase';
import { IconAlertTriangle, IconLink, IconCheck } from '@/components/icons';
import type { Course, Group } from '@/types';

interface PageProps {
  course: Pick<Course, 'id' | 'name' | 'subject'> | null;
}

export default function JoinCoursePage({ course }: PageProps) {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const { groups } = useGroups(user?.id);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [status, setStatus] = useState<'idle' | 'linking' | 'linked' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const leadGroups = groups.filter((g) => g.lead_id === user?.id && !g.course_id);
  const isMemberOnly = groups.length > 0 && groups.every((g) => g.lead_id !== user?.id);

  async function handleLink() {
    if (!course || !selectedGroupId) return;
    setStatus('linking');
    const { error } = await supabase
      .from('groups')
      .update({ course_id: course.id })
      .eq('id', selectedGroupId)
      .eq('lead_id', user!.id);
    if (error) { setErrorMsg(error.message); setStatus('error'); return; }
    setStatus('linked');
    setTimeout(() => router.push(`/group/${selectedGroupId}`), 1500);
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold">Failed to link group</p>
        <p className="text-sm text-muted">{errorMsg}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
      </div>
    );
  }

  if (status === 'linked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <span className="text-green"><IconCheck size={32} /></span>
        <p className="text-lg font-semibold text-green">Group linked! Redirecting…</p>
      </div>
    );
  }

  // Not found
  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconLink size={32} /></span>
        <p className="text-lg font-semibold">Course link not found</p>
        <p className="text-sm text-muted">This link is no longer valid. Ask your teacher for a new course link.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 bg-bg">
      <div className="bg-white border border-border rounded-xl p-6 max-w-sm w-full shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-light text-brand font-bold text-xl flex items-center justify-center mx-auto mb-4">
          {course.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-text mb-0.5 text-center">{course.name}</h1>
        <p className="text-sm text-text-tertiary mb-2 text-center">{course.subject}</p>
        <p className="text-[12px] text-text-secondary text-center mb-6 leading-snug">
          Your teacher shared this link so you can connect your group to this course.
        </p>

        {/* Unauthenticated */}
        {userLoading ? (
          <div className="w-full h-11 bg-border rounded-md animate-pulse" />
        ) : !user ? (
          <div className="text-center">
            <button
              onClick={() => router.push(`/signup?returnTo=/join/course/${token}`)}
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors mb-2"
            >
              Sign up to link your group
            </button>
            <p className="text-[12px] text-text-tertiary">
              Already have an account?{' '}
              <button onClick={() => router.push(`/login?returnTo=/join/course/${token}`)} className="text-brand font-medium hover:underline">Log in</button>
            </p>
          </div>
        ) : leadGroups.length === 0 ? (
          <div className="text-center">
            {isMemberOnly ? (
              <>
                <p className="text-sm text-text-secondary mb-1">
                  Only your group lead can connect a group to this course.
                </p>
                <p className="text-sm text-text-tertiary mb-4">
                  Share this link with your group lead and ask them to open it.
                </p>
                <button onClick={() => router.push('/dashboard')} className="w-full h-11 border border-border text-text-secondary text-sm font-medium rounded-md hover:bg-bg-hover transition-colors">
                  Go to dashboard
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary mb-4">
                  You need to be the lead of a group to connect it to this course.
                </p>
                <button
                  onClick={() => router.push(`/dashboard?newGroup=1&courseToken=${token}`)}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors mb-2"
                >
                  Create a new group
                </button>
                <button onClick={() => router.push('/dashboard')} className="w-full h-11 border border-border text-text-secondary text-sm font-medium rounded-md hover:bg-bg-hover transition-colors">
                  Go to dashboard
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[13px] font-medium text-text-secondary">Select your group to link</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2.5 text-[14px] focus:border-brand outline-none bg-white"
              >
                <option value="">Choose a group…</option>
                {leadGroups.map((g: Group) => (
                  <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLink}
              disabled={!selectedGroupId || status === 'linking'}
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
            >
              {status === 'linking' ? 'Linking…' : 'Link group to course'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = ctx.params?.token;
  if (typeof token !== 'string') return { props: { course: null } };

  // Use service role to bypass RLS — only reading public fields
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: course } = await admin
    .from('courses')
    .select('id, name, subject')
    .eq('invite_token', token)
    .single();

  return { props: { course: course ?? null } };
}
