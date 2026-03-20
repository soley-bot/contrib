import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/hooks/use-user';
import { useGroups } from '@/hooks/use-groups';
import { supabase } from '@/lib/supabase';
import type { Course, Group } from '@/types';

export default function JoinCoursePage() {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const { groups } = useGroups(user?.id);
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [status, setStatus] = useState<'loading' | 'found' | 'not-found' | 'linking' | 'linked' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!userLoading && !user) {
      router.replace(`/signup?returnTo=/join/course/${token}`);
      return;
    }
    if (user && token) fetchCourse();
  }, [router.isReady, user, userLoading, token]);

  async function fetchCourse() {
    const { data } = await supabase.from('courses').select('*').eq('invite_token', token).single();
    if (!data) { setStatus('not-found'); return; }
    setCourse(data as Course);
    setStatus('found');
  }

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
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  const leadGroups = groups.filter((g) => g.lead_id === user?.id && !g.course_id);

  if (status === 'loading' || userLoading) {
    return <div className="flex items-center justify-center min-h-dvh text-[#57534E]">Loading…</div>;
  }

  if (status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <p className="text-3xl">🔗</p>
        <p className="text-lg font-semibold">Course link not found</p>
        <p className="text-sm text-[#6B7280]">This invite link is invalid or has been removed.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <p className="text-3xl">⚠️</p>
        <p className="text-lg font-semibold">Failed to link group</p>
        <p className="text-sm text-[#6B7280]">{errorMsg}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
      </div>
    );
  }

  if (status === 'linked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <p className="text-3xl">🎉</p>
        <p className="text-lg font-semibold text-[#22C55E]">Group linked! Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 bg-[#F9FAFB]">
      <div className="bg-white border border-[#E7E5E4] rounded-[10px] p-6 max-w-sm w-full shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-brand-light text-brand font-bold text-xl flex items-center justify-center mx-auto mb-4">
          {course?.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-[#1C1917] mb-0.5 text-center">{course?.name}</h1>
        <p className="text-sm text-[#A8A29E] mb-6 text-center">{course?.subject}</p>

        {leadGroups.length === 0 ? (
          <div className="text-center">
            <p className="text-sm text-[#57534E] mb-4">
              You need to be the lead of an unlinked group to connect it to this course.
            </p>
            <button
              onClick={() => router.push(`/dashboard?newGroup=1&courseToken=${token}`)}
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors mb-2"
            >
              Create a new group
            </button>
            <button onClick={() => router.push('/dashboard')} className="w-full h-11 border border-[#E7E5E4] text-[#57534E] text-sm font-medium rounded-md hover:bg-[#F5F5F4] transition-colors">
              Go to dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[13px] font-medium text-[#57534E]">Select your group to link</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[14px] focus:border-brand outline-none bg-white"
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
