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
import type { Group, GroupMember, Task, ActivityLog, Evidence, EvaluationSummary } from '@/types';

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
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupSubject, setEditGroupSubject] = useState('');
  const [editGroupDueDate, setEditGroupDueDate] = useState('');
  const [editGroupError, setEditGroupError] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && (!profile || profile.role !== 'teacher')) router.replace('/dashboard');
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

  function openEditGroup(group: Group) {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupSubject(group.subject);
    setEditGroupDueDate(group.due_date ?? '');
    setEditGroupError('');
  }

  async function handleEditGroupSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    setEditGroupError('');
    if (!editGroupName.trim() || !editGroupSubject.trim()) { setEditGroupError('Name and subject are required.'); return; }
    setSavingGroup(true);
    const { error } = await supabase
      .from('groups')
      .update({ name: editGroupName.trim(), subject: editGroupSubject.trim(), due_date: editGroupDueDate || null })
      .eq('id', editingGroup.id);
    setSavingGroup(false);
    if (error) { setEditGroupError(error.message); return; }
    refresh();
    setEditingGroup(null);
  }

  async function handleDeleteGroup() {
    if (!confirmDeleteGroupId) return;
    setDeletingGroupId(confirmDeleteGroupId);
    const { error } = await supabase.from('groups').delete().eq('id', confirmDeleteGroupId);
    setDeletingGroupId(null);
    if (error) { alert('Failed to delete group.'); return; }
    setConfirmDeleteGroupId(null);
    refresh();
  }

  async function handleDownloadPdf(group: Group) {
    setDownloadingId(group.id);
    const [membersRes, tasksRes, activityRes] = await Promise.all([
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', group.id).order('joined_at', { ascending: true }),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
    ]);
    if (membersRes.error || tasksRes.error || activityRes.error) { alert('Failed to load group data for PDF.'); setDownloadingId(null); return; }
    const taskIds = ((tasksRes.data as Task[]) ?? []).map((t) => t.id);
    const [evidenceRes, evalRes] = await Promise.all([
      taskIds.length > 0
        ? supabase.from('evidence').select('*, uploader:profiles(name)').in('task_id', taskIds)
        : Promise.resolve({ data: [] as Evidence[], error: null }),
      supabase.from('evaluation_summaries').select('*').eq('group_id', group.id),
    ]);
    if (evidenceRes.error || evalRes.error) { alert('Failed to load evidence or evaluations for PDF.'); setDownloadingId(null); return; }
    const evidenceByTask: Record<string, Evidence[]> = {};
    ((evidenceRes.data as Evidence[]) ?? []).forEach((e) => {
      if (!evidenceByTask[e.task_id]) evidenceByTask[e.task_id] = [];
      evidenceByTask[e.task_id].push(e);
    });
    generateReport(group, (membersRes.data as GroupMember[]) ?? [], (tasksRes.data as Task[]) ?? [], (activityRes.data as ActivityLog[]) ?? [], evidenceByTask, (evalRes.data as EvaluationSummary[]) ?? []);
    setDownloadingId(null);
  }

  async function handleCreateGroup() {
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

  const totalMembers = groups.reduce((s, g) => s + g.memberCount, 0);
  const totalTasks = groups.reduce((s, g) => s + g.taskTotal, 0);
  const totalDone = groups.reduce((s, g) => s + g.taskDone, 0);
  const completionPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const overdueCount = groups.filter(({ group, taskDone: done, taskTotal: total }) =>
    group.due_date && new Date(group.due_date + 'T00:00:00') < todayDate && done < total
  ).length;

  if (loading || courseLoading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  if (!course) return null;

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <Nav
        profile={profile}
        role="teacher"
        title={course.name}
        backLabel="My Courses"
        onBack={() => router.push('/teacher')}
        onProfileUpdate={refreshProfile}
      />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/teacher')} className="text-[#94A3B8] hover:text-brand text-sm transition-colors">My Courses</button>
            <span className="text-[#94A3B8] text-sm">/</span>
            <span className="text-base font-semibold text-[#0F172A]">{course.name}</span>
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
          <div className="mb-4 p-3 bg-[#EBF0FF] rounded-[8px] border border-[#93B4FF]">
            <p className="text-[11px] font-semibold text-[#1240C4] uppercase tracking-wide mb-1">Student invite link</p>
            <p className="text-[12px] text-[#0E3AAF] break-all font-mono bg-white px-2 py-1.5 rounded-md border border-[#C5D5FF] mt-1">{inviteBase ? courseInviteLink : 'Loading…'}</p>
            {inviteBase && (
              <button
                onClick={() => navigator.clipboard.writeText(courseInviteLink)}
                className="mt-1.5 text-[11px] text-[#1240C4] font-medium hover:underline"
              >
                Copy link
              </button>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex gap-2.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'Groups',     value: groups.length,  color: '' },
                { label: 'Students',   value: totalMembers,   color: '' },
                { label: 'Completion', value: `${completionPct}%`, color: completionPct === 100 ? '#16A34A' : '' },
                ...(overdueCount > 0 ? [{ label: 'Overdue', value: overdueCount, color: '#DC2626' }] : []),
              ].map((s) => (
                <div key={s.label} className="flex-shrink-0 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 min-w-[76px] shadow-sm">
                  <p className="text-lg font-bold" style={{ color: s.color || '#0F172A' }}>{s.value}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {groups.length === 0 ? (
            <div className="text-center py-12">
              <svg viewBox="0 0 160 100" fill="none" className="w-36 mx-auto mb-4">
                <ellipse cx="80" cy="92" rx="56" ry="6" fill="#EBF0FF"/>
                <circle cx="40" cy="36" r="10" fill="#93B4FF"/>
                <rect x="28" y="52" width="24" height="16" rx="6" fill="#1240C4"/>
                <circle cx="80" cy="30" r="12" fill="#C5D5FF"/>
                <rect x="66" y="48" width="28" height="18" rx="7" fill="#0E3AAF"/>
                <circle cx="120" cy="36" r="10" fill="#93B4FF"/>
                <rect x="108" y="52" width="24" height="16" rx="6" fill="#1240C4"/>
                <circle cx="80" cy="18" r="10" fill="#1240C4"/>
                <path d="M80 13v10M75 18h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-[15px] font-bold text-[#0F172A] mb-1">No groups yet</p>
              <p className="text-sm text-[#94A3B8] mb-4 max-w-xs mx-auto">Share the invite link above or create groups manually.</p>
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
                  onClick={() => router.push(`/teacher/course/${courseId}/group/${group.id}`)}
                  onEdit={() => openEditGroup(group)}
                  onDelete={() => setConfirmDeleteGroupId(group.id)}
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

      {editingGroup && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingGroup(null); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">Edit Group</h2>
              <button onClick={() => setEditingGroup(null)} className="text-[#475569] hover:text-[#0F172A] p-1">✕</button>
            </div>
            <form onSubmit={handleEditGroupSave} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Group name</label>
                <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} placeholder="e.g. Group A"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Subject code</label>
                <input type="text" value={editGroupSubject} onChange={(e) => setEditGroupSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Due date <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                <input type="date" value={editGroupDueDate} onChange={(e) => setEditGroupDueDate(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {editGroupError && <p className="text-sm text-red-500">{editGroupError}</p>}
              <div className="pt-1 border-t border-[#E2E8F0]">
                <button type="submit" disabled={savingGroup}
                  className="w-full h-11 bg-[#1240C4] hover:bg-[#0E3AAF] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {savingGroup ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteGroupId && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-[360px] bg-white rounded-xl p-6" style={{ boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-1">Delete group?</h2>
            <p className="text-sm text-[#475569] mb-5">This will permanently delete the group and all its tasks, members, and activity. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteGroupId(null)}
                className="flex-1 h-10 border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[13px] font-medium text-[#475569] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={!!deletingGroupId}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60"
              >
                {deletingGroupId ? 'Deleting…' : 'Delete group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">New Group</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-[#475569] hover:text-[#0F172A] transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Group name</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Group A"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#475569]">Due date <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-[#E2E8F0]">
                <button onClick={handleCreateGroup} disabled={creating}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
