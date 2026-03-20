import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import CourseCard from '@/components/course-card';
import { IconPlus } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useCourses } from '@/hooks/use-courses';
import { useCreateCourse } from '@/hooks/use-create-course';
import { supabase } from '@/lib/supabase';

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useUser();
  const { courses, refresh: refreshCourses } = useCourses(user?.id);
  const { createCourse, creating } = useCreateCourse();
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [subject, setSubject] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && profile && profile.role !== 'teacher') router.replace('/dashboard');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (courses.length === 0) return;
    fetchGroupCounts(courses.map((c) => c.id));
  }, [courses]);

  async function fetchGroupCounts(courseIds: string[]) {
    const { data } = await supabase
      .from('groups')
      .select('course_id')
      .in('course_id', courseIds);
    const counts: Record<string, number> = {};
    courseIds.forEach((id) => { counts[id] = 0; });
    (data ?? []).forEach((row: { course_id: string }) => {
      counts[row.course_id] = (counts[row.course_id] ?? 0) + 1;
    });
    setGroupCounts(counts);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!courseName.trim() || !subject.trim()) { setFormError('Course name and subject are required.'); return; }
    const course = await createCourse({ name: courseName, subject, teacherId: user!.id });
    if (!course) { setFormError('Failed to create course.'); return; }
    refreshCourses();
    setShowModal(false); setCourseName(''); setSubject('');
    router.push(`/teacher/course/${course.id}`);
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh text-[#57534E]">Loading…</div>;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} role="teacher" onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <span className="text-base font-semibold text-[#1C1917]">My Courses</span>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New course
          </button>
        </div>

        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {courses.length === 0 ? (
            <div className="text-center py-20 text-[#A8A29E]">
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-sm">No courses yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-2">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  groupCount={groupCounts[course.id] ?? 0}
                  onClick={() => router.push(`/teacher/course/${course.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-brand text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(37,99,235,.3)' }}
      >
        <IconPlus size={22} />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px]">
            <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
              <h2 className="text-base font-semibold text-[#1C1917]">New Course</h2>
              <button onClick={() => setShowModal(false)} className="text-[#57534E] hover:text-[#1C1917] p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Course name</label>
                <input type="text" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g. Business Management"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
