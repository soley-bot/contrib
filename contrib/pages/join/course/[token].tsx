import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { adminClient } from '@/lib/supabase-admin';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import { IconAlertTriangle, IconLink, IconCheck } from '@/components/icons';
import type { Course } from '@/types';

interface PageProps {
  course: (Pick<Course, 'id' | 'name' | 'subject'> & { teacherName: string }) | null;
}

export default function JoinCoursePage({ course }: PageProps) {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: userLoading } = useUser();
  const [status, setStatus] = useState<'idle' | 'already' | 'joining' | 'joined' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Check if already a course member
  useEffect(() => {
    if (!course || userLoading || !user) return;
    supabase
      .from('course_members')
      .select('id')
      .eq('course_id', course.id)
      .eq('profile_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setStatus('already');
      });
  }, [course, user, userLoading]);

  async function handleJoin() {
    if (!course || !user) return;
    setStatus('joining');

    try {
      const resp = await fetch(`/api/courses/${course.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMsg(data.error || 'Failed to join course.');
        setStatus('error');
        return;
      }

      if (data.already) {
        setStatus('already');
        return;
      }

      setStatus('joined');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold">Failed to join course</p>
        <p className="text-sm text-muted">{errorMsg}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 text-brand text-sm font-medium">Back to dashboard</button>
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
        <p className="text-lg font-semibold">You&apos;re already in this course</p>
        <p className="text-sm text-muted">{course?.name}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-2 h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover">Go to dashboard</button>
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
        <p className="text-sm text-text-tertiary mb-1 text-center">{course.subject}</p>
        <p className="text-[12px] text-text-secondary text-center mb-6 leading-snug">
          Taught by {course.teacherName}
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
              Sign up to join this course
            </button>
            <p className="text-[12px] text-text-tertiary">
              Already have an account?{' '}
              <button onClick={() => router.push(`/login?returnTo=/join/course/${token}`)} className="text-brand font-medium hover:underline">Log in</button>
            </p>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
          >
            {status === 'joining' ? 'Joining…' : 'Join course'}
          </button>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = ctx.params?.token;
  if (typeof token !== 'string') return { props: { course: null } };

  // Use service role to bypass RLS — only reading public fields
  const { data: course } = await adminClient
    .from('courses')
    .select('id, name, subject, teacher_id')
    .eq('invite_token', token)
    .single();

  if (!course) return { props: { course: null } };

  const { data: teacher } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', course.teacher_id)
    .single();

  return {
    props: {
      course: {
        id: course.id,
        name: course.name,
        subject: course.subject,
        teacherName: teacher?.name ?? 'your teacher',
      },
    },
  };
}
