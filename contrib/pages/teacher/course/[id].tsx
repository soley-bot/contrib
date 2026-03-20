import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import CourseGroupRow from '@/components/course-group-row';
import { IconPlus } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useCourse } from '@/hooks/use-course';
import { supabase } from '@/lib/supabase';
import { generateInviteToken } from '@/lib/invite';
import { generateReport } from '@/lib/pdf';
import type { Group, GroupMember, Task, ActivityLog } from '@/types';

export default function CourseDetail() {
  const router = useRouter();
  const courseId = typeof router.query.id === 'string' ? router.query.id : undefined;
  const { user, profile, loading, refreshProfile } = useUser();
  const { course, groups, isOwner, loading: courseLoading, refresh } = useCourse(courseId, user?.id);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [inviteBase, setInviteBase] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && profile && profile.role !== 'teacher') router.replace('/dashboard');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!courseLoading && course && !isOwner) router.replace('/teacher');
  }, [course, isOwner, courseLoading, router]);

  useEffect(() => {
    setInviteBase(`${window.location.origin}/join/course/`);
  }, []);

  async function handleDownloadPdf(group: Group) {
    setDownloadingId(group.id);
    const [{ data: membersData }, { data: tasksData }, { data: activityData }] = await Promise.all([
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', group.id).order('joined_at', { ascending: true }),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
    ]);
    generateReport(group, (membersData as GroupMember[]) ?? [], (tasksData as Task[]) ?? [], (activityData as ActivityLog[]) ?? []);
    setDownloadingId(null);
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!groupName.trim() || !subject.trim()) { setFormError('Group name and subject are required.'); return; }
    setCreating(true);
    const token = generateInviteToken();
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), subject: subject.trim(), due_date: dueDate || null, lead_id: user!.id, invite_token: token, course_id: courseId })
      .select().single();
    if (error || !group) { setFormError(error?.message ?? 'Failed to create group.'); setCreating(false); return; }
    await supabase.from('group_members').insert({ group_id: group.id, profile_id: user!.id });
    await supabase.from('activity_log').insert({ group_id: group.id, actor_id: user!.id, action: 'member_joined', meta: {} });
    refresh();
    setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setCreating(false);
  }

  if (loading || courseLoading) return <div className="flex items-center justify-center min-h-dvh text-[#57534E]">Loading…</div>;
  if (!course) return null;

  const courseInviteLink = `${inviteBase}${course.invite_token}`;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} role="teacher" onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/teacher')} className="text-[#A8A29E] hover:text-brand text-sm transition-colors">My Courses</button>
            <span className="text-[#A8A29E] text-sm">/</span>
            <span className="text-base font-semibold text-[#1C1917]">{course.name}</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {/* Course invite link for students */}
          <div className="mb-4 p-3 bg-brand-light rounded-[8px] border border-brand-border">
            <p className="text-[11px] font-semibold text-brand uppercase tracking-wide mb-1">Student invite link</p>
            <p className="text-[12px] text-[#57534E] break-all font-mono">{inviteBase ? courseInviteLink : 'Loading…'}</p>
            {inviteBase && (
              <button
                onClick={() => navigator.clipboard.writeText(courseInviteLink)}
                className="mt-1.5 text-[11px] text-brand font-medium hover:underline"
              >
                Copy link
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-16 text-[#A8A29E]">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-sm">No groups yet. Create one or share the invite link with students.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-2">
              {groups.map(({ group, taskTotal, taskDone, memberCount }) => (
                <CourseGroupRow
                  key={group.id}
                  group={group}
                  taskTotal={taskTotal}
                  taskDone={taskDone}
                  memberCount={memberCount}
                  onDownloadPdf={() => handleDownloadPdf(group)}
                  downloading={downloadingId === group.id}
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
              <h2 className="text-base font-semibold text-[#1C1917]">New Group</h2>
              <button onClick={() => setShowModal(false)} className="text-[#57534E] hover:text-[#1C1917] p-1">✕</button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Group name</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Group A"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
