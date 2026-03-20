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
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
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
    setInviteBase(`${window.location.origin}/join/`);
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    const ids = groups.map(({ group }) => group.id);
    supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .in('group_id', ids)
      .order('joined_at', { ascending: true })
      .then(({ data }) => {
        const map: Record<string, GroupMember[]> = {};
        ids.forEach((id) => { map[id] = []; });
        (data as GroupMember[] ?? []).forEach((m) => { map[m.group_id]?.push(m); });
        setGroupMembers(map);
      });
  }, [groups]);

  const courseInviteLink = course ? `${inviteBase}course/${course.invite_token}` : '';

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
    refresh();
    setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setCreating(false);
  }

  if (loading || courseLoading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" style={{ borderTopColor: '#0E7490' }} /></div>;
  if (!course) return null;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} role="teacher" onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/teacher')} className="text-[#A8A29E] hover:text-[#FF5841] text-sm transition-colors">My Courses</button>
            <span className="text-[#A8A29E] text-sm">/</span>
            <span className="text-base font-semibold text-[#1C1917]">{course.name}</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-3 bg-[#0E7490] hover:bg-[#0C6478] text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        <div className="pt-14 md:pt-0 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {/* Course invite link for students */}
          <div className="mb-4 p-3 bg-[#F0FDFA] rounded-[8px] border border-[#A5F3FC]">
            <p className="text-[11px] font-semibold text-[#0E7490] uppercase tracking-wide mb-1">Student invite link</p>
            <p className="text-[12px] text-[#0A5468] break-all font-mono bg-white px-2 py-1.5 rounded-md border border-[#CFFAFE] mt-1">{inviteBase ? courseInviteLink : 'Loading…'}</p>
            {inviteBase && (
              <button
                onClick={() => navigator.clipboard.writeText(courseInviteLink)}
                className="mt-1.5 text-[11px] text-[#0E7490] font-medium hover:underline"
              >
                Copy link
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-12">
              <svg viewBox="0 0 160 100" fill="none" className="w-36 mx-auto mb-4">
                <ellipse cx="80" cy="92" rx="56" ry="6" fill="#F0FDFA"/>
                {/* 3 person icons */}
                <circle cx="40" cy="36" r="10" fill="#BAE6FD"/>
                <rect x="28" y="52" width="24" height="16" rx="6" fill="#0E7490"/>
                <circle cx="80" cy="30" r="12" fill="#A5F3FC"/>
                <rect x="66" y="48" width="28" height="18" rx="7" fill="#0C6478"/>
                <circle cx="120" cy="36" r="10" fill="#BAE6FD"/>
                <rect x="108" y="52" width="24" height="16" rx="6" fill="#0E7490"/>
                {/* plus bubble */}
                <circle cx="80" cy="18" r="10" fill="#0E7490"/>
                <path d="M80 13v10M75 18h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-[15px] font-bold text-[#1C1917] mb-1">No groups yet</p>
              <p className="text-sm text-[#A8A29E] mb-4 max-w-xs mx-auto">Share the invite link above or create groups manually.</p>
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
                  members={groupMembers[group.id]}
                  inviteLink={inviteBase ? `${inviteBase}${group.invite_token}` : ''}
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
        className="md:hidden fixed right-5 bottom-6 w-[52px] h-[52px] rounded-full bg-[#0E7490] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 16px rgba(14,116,144,.4)' }}
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
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creating}
                  className="w-full h-11 bg-[#0E7490] hover:bg-[#0C6478] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
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
