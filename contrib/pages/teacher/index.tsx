import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import Nav from '@/components/nav';
import CourseCard from '@/components/course-card';
import { IconPlus } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { requireTeacher } from '@/lib/supabase-server';
import { useCourses } from '@/hooks/use-courses';
import { useCreateCourse } from '@/hooks/use-create-course';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useUser();
  const { courses, refresh: refreshCourses } = useCourses(user?.id);
  const { createCourse, creating } = useCreateCourse();
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  // Create course modal
  const [showModal, setShowModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [subject, setSubject] = useState('');
  const [formError, setFormError] = useState('');

  // Edit course modal
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete course confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && (!profile || profile.role !== 'teacher')) router.replace('/dashboard');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (courses.length === 0) return;
    fetchGroupCounts(courses.map((c) => c.id));
  }, [courses]);

  async function fetchGroupCounts(courseIds: string[]) {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id, course_id')
      .in('course_id', courseIds);
    const groups = (groupData ?? []) as { id: string; course_id: string }[];
    const counts: Record<string, number> = {};
    courseIds.forEach((id) => { counts[id] = 0; });
    groups.forEach((row) => { counts[row.course_id] = (counts[row.course_id] ?? 0) + 1; });
    setGroupCounts(counts);

    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) return;
    const { data: memberData } = await supabase.from('group_members').select('group_id').in('group_id', groupIds);
    const groupCourseMap: Record<string, string> = {};
    groups.forEach((g) => { groupCourseMap[g.id] = g.course_id; });
    const mCounts: Record<string, number> = {};
    courseIds.forEach((id) => { mCounts[id] = 0; });
    (memberData ?? []).forEach((row: { group_id: string }) => {
      const cid = groupCourseMap[row.group_id];
      if (cid) mCounts[cid] = (mCounts[cid] ?? 0) + 1;
    });
    setMemberCounts(mCounts);
  }

  async function handleCreate() {
    setFormError('');
    if (!courseName.trim() || !subject.trim()) { setFormError('Course name and subject are required.'); return; }
    const course = await createCourse({ name: courseName, subject, teacherId: user!.id });
    if (!course) { setFormError('Failed to create course.'); return; }
    refreshCourses();
    setShowModal(false); setCourseName(''); setSubject('');
    router.push(`/teacher/course/${course.id}`);
  }

  function openEdit(course: Course) {
    setEditingCourse(course);
    setEditName(course.name);
    setEditSubject(course.subject);
    setEditError('');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCourse) return;
    setEditError('');
    if (!editName.trim() || !editSubject.trim()) { setEditError('Course name and subject are required.'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('courses')
      .update({ name: editName.trim(), subject: editSubject.trim() })
      .eq('id', editingCourse.id);
    setSaving(false);
    if (error) { setEditError(error.message); return; }
    refreshCourses();
    setEditingCourse(null);
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await supabase.from('courses').delete().eq('id', confirmDeleteId);
    setDeleting(false);
    setConfirmDeleteId(null);
    refreshCourses();
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" style={{ borderTopColor: '#1240C4' }} /></div>;

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <Nav profile={profile} role="teacher" onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E2E8F0]">
          <span className="text-base font-semibold text-[#0F172A]">My Courses</span>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New course
          </button>
        </div>

        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {courses.length === 0 ? (
            <div className="text-center py-14">
              <svg viewBox="0 0 200 140" fill="none" className="w-48 mx-auto mb-5">
                <ellipse cx="100" cy="128" rx="72" ry="8" fill="#EBF0FF"/>
                <rect x="30" y="20" width="140" height="80" rx="6" fill="#1240C4"/>
                <rect x="36" y="26" width="128" height="68" rx="4" fill="#0E3AAF"/>
                <rect x="46" y="36" width="48" height="4" rx="2" fill="white" fillOpacity="0.7"/>
                <rect x="46" y="44" width="32" height="4" rx="2" fill="white" fillOpacity="0.5"/>
                <rect x="46" y="52" width="40" height="4" rx="2" fill="white" fillOpacity="0.5"/>
                <rect x="108" y="36" width="16" height="16" rx="3" fill="white" fillOpacity="0.15"/>
                <path d="M112 44l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="108" y="56" width="16" height="16" rx="3" fill="white" fillOpacity="0.15"/>
                <rect x="108" y="76" width="16" height="6" rx="2" fill="white" fillOpacity="0.3"/>
                <rect x="30" y="100" width="140" height="8" rx="2" fill="#0E3AAF"/>
                <circle cx="100" cy="56" r="10" fill="#93B4FF"/>
                <rect x="88" y="72" width="24" height="16" rx="6" fill="#1240C4"/>
                <rect x="92" y="46" width="16" height="3" rx="1.5" fill="#0F172A"/>
                <polygon points="100,42 110,47 100,52 90,47" fill="#0F172A"/>
              </svg>
              <p className="text-[16px] font-bold text-[#0F172A] mb-1.5">No courses yet</p>
              <p className="text-sm text-[#94A3B8] mb-6 max-w-xs mx-auto">Create your first course and share the invite link with your students.</p>
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 h-11 px-6 bg-brand hover:bg-brand-hover text-white text-[14px] font-medium rounded-md transition-colors">
                <IconPlus size={16} /> Create your first course
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-2">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  groupCount={groupCounts[course.id] ?? 0}
                  memberCount={memberCounts[course.id]}
                  onClick={() => router.push(`/teacher/course/${course.id}`)}
                  onEdit={() => openEdit(course)}
                  onDelete={() => setConfirmDeleteId(course.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-brand text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(18,64,196,.4)' }}
      >
        <IconPlus size={22} />
      </button>

      {/* Delete course confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-[360px] bg-white rounded-xl p-6" style={{ boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-1">Delete course?</h2>
            <p className="text-sm text-[#475569] mb-5">This will permanently delete the course and all its groups, tasks, and members. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-10 border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[13px] font-medium text-[#475569] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit course modal */}
      {editingCourse && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingCourse(null); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">Edit Course</h2>
              <button onClick={() => setEditingCourse(null)} className="text-[#475569] hover:text-[#0F172A] p-1">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Course name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Business Management"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Subject code</label>
                <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
              <div className="pt-1 border-t border-[#E2E8F0]">
                <button type="submit" disabled={saving}
                  className="w-full h-11 bg-[#1240C4] hover:bg-[#0E3AAF] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create course modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">New Course</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-[#475569] hover:text-[#0F172A] transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Course name</label>
                <input type="text" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g. Business Management"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E2E8F0]">
                <button onClick={handleCreate} disabled={creating}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create course'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireTeacher(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
