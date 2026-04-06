import { useState, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import TeacherNav from '@/components/teacher-nav';
import CourseGroupRow from '@/components/course-group-row';
import InlineTip from '@/components/inline-tip';
import type { GroupHealthStatus } from '@/components/course-group-row';
import { IconPlus } from '@/components/icons';
import AssignGroupModal from '@/components/assign-group-modal';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/toast-provider';
import { requireTeacher } from '@/lib/supabase-server';
import { useCourse } from '@/hooks/use-course';
import { useCourseAnalytics } from '@/hooks/use-course-analytics';
import { supabase } from '@/lib/supabase';

import { generateReport } from '@/lib/pdf';
import type { Group, GroupMember, Profile, Task, ActivityLog, Evidence, EvaluationSummary } from '@/types';

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
  const [filterMode, setFilterMode] = useState<'all' | 'attention'>('all');
  const [courseResetState, setCourseResetState] = useState<'idle' | 'confirm' | 'resetting' | 'done'>('idle');
  const [ungroupedStudents, setUngroupedStudents] = useState<Profile[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState<Profile[]>([]);
  const [assigningStudent, setAssigningStudent] = useState<Profile | null>(null);
  const [blockerCounts, setBlockerCounts] = useState<Record<string, number>>({});
  const { showToast } = useToast();

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
      .select('id, group_id, profile_id, joined_at, profile:profiles!group_members_profile_id_fkey(id, name, university, faculty, year_of_study, avatar_url, role)')
      .in('group_id', ids)
      .order('joined_at', { ascending: true })
      .then(({ data }) => {
        const map: Record<string, GroupMember[]> = {};
        ids.forEach((id) => { map[id] = []; });
        ((data as unknown as GroupMember[]) ?? []).forEach((m) => { map[m.group_id]?.push(m); });
        setGroupMembers(map);
      });
  }, [groups]);

  useEffect(() => {
    if (!courseId || courseLoading || !course) return;
    (async () => {
      const { data: members } = await supabase
        .from('course_members')
        .select('profile_id')
        .eq('course_id', courseId);
      if (!members || members.length === 0) { setEnrolledStudents([]); return; }
      const memberIds = members.map((m: { profile_id: string }) => m.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, university, faculty, year_of_study, avatar_url, role, created_at')
        .in('id', memberIds)
        .eq('role', 'student');
      setEnrolledStudents((profiles as Profile[]) ?? []);
    })();
  }, [courseId, courseLoading, course]);

  // Fetch enrolled students who haven't joined a group in this course
  useEffect(() => {
    if (!courseId || courseLoading || !course) return;
    (async () => {
      // Get all course members
      const { data: members } = await supabase
        .from('course_members')
        .select('profile_id')
        .eq('course_id', courseId);
      if (!members || members.length === 0) { setUngroupedStudents([]); return; }

      const memberIds = members.map((m: { profile_id: string }) => m.profile_id);

      // Get all group member profile_ids in this course
      const groupIds = groups.map(({ group }) => group.id);
      let groupedIds: Set<string> = new Set();
      if (groupIds.length > 0) {
        const { data: gm } = await supabase
          .from('group_members')
          .select('profile_id')
          .in('group_id', groupIds);
        if (gm) groupedIds = new Set(gm.map((r: { profile_id: string }) => r.profile_id));
      }

      const ungroupedIds = memberIds.filter((id: string) => !groupedIds.has(id));
      if (ungroupedIds.length === 0) { setUngroupedStudents([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, university, faculty, year_of_study, avatar_url, role, created_at')
        .in('id', ungroupedIds);
      setUngroupedStudents((profiles as Profile[]) ?? []);
    })();
  }, [courseId, courseLoading, course, groups]);

  const groupIds = useMemo(() => groups.map(({ group }) => group.id), [groups]);

  useEffect(() => {
    if (groupIds.length === 0) return;
    (async () => {
      const { data, error } = await supabase
        .from('blocker_declarations')
        .select('group_id')
        .in('group_id', groupIds);
      if (error) {
        Sentry.captureMessage(`Failed to load blocker counts: ${error.message}`, { level: 'warning' });
        return;
      }
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: { group_id: string }) => {
        counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
      });
      setBlockerCounts(counts);
    })();
  }, [groupIds.join(',')]);

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
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGroupName.trim(),
          subject: editGroupSubject.trim(),
          dueDate: editGroupDueDate || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setEditGroupError(json.error ?? 'Failed to update group.');
        setSavingGroup(false);
        return;
      }
    } catch {
      setEditGroupError('Failed to update group.');
      setSavingGroup(false);
      return;
    }
    setSavingGroup(false);
    refresh();
    setEditingGroup(null);
  }

  async function handleDeleteGroup() {
    if (!confirmDeleteGroupId) return;
    setDeletingGroupId(confirmDeleteGroupId);
    const res = await fetch(`/api/groups/${confirmDeleteGroupId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setDeletingGroupId(null);
    if (!res.ok) { showToast('Failed to delete group.', 'error'); return; }
    setConfirmDeleteGroupId(null);
    refresh();
  }

  async function handleDownloadPdf(group: Group) {
    setDownloadingId(group.id);
    const [membersRes, tasksRes, activityRes] = await Promise.all([
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', group.id).order('joined_at', { ascending: true }),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').eq('group_id', group.id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
    ]);
    if (membersRes.error || tasksRes.error || activityRes.error) { showToast('Failed to load group data for PDF.', 'error'); setDownloadingId(null); return; }
    const taskIds = ((tasksRes.data as Task[]) ?? []).map((t) => t.id);
    const [evidenceRes, evalRes] = await Promise.all([
      taskIds.length > 0
        ? supabase.from('evidence').select('id, task_id, uploaded_by, type, content, version_number, created_at, uploader:profiles(name)').in('task_id', taskIds)
        : Promise.resolve({ data: [] as Evidence[], error: null }),
      supabase.from('evaluation_summaries').select('group_id, evaluatee_id, avg_contribution, avg_collaboration, eval_count, comments').eq('group_id', group.id),
    ]);
    if (evidenceRes.error || evalRes.error) { showToast('Failed to load evidence or evaluations for PDF.', 'error'); setDownloadingId(null); return; }
    const evidenceByTask: Record<string, Evidence[]> = {};
    ((evidenceRes.data as Evidence[]) ?? []).forEach((e) => {
      if (!evidenceByTask[e.task_id]) evidenceByTask[e.task_id] = [];
      evidenceByTask[e.task_id].push(e);
    });
    await generateReport(group, (membersRes.data as GroupMember[]) ?? [], (tasksRes.data as Task[]) ?? [], (activityRes.data as ActivityLog[]) ?? [], evidenceByTask, (evalRes.data as EvaluationSummary[]) ?? [], undefined, 'teacher', course?.name);
    setDownloadingId(null);
  }

  async function handleCreateGroup() {
    if (creating) return;
    setFormError('');
    if (!groupName.trim() || !subject.trim()) { setFormError('Group name and subject are required.'); return; }
    setCreating(true);
    try {
      const resp = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          subject: subject.trim(),
          dueDate: dueDate || null,
          courseId: courseId,
          ...(selectedLeadId ? { leadId: selectedLeadId } : {}),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) { setFormError(data.error ?? 'Failed to create group.'); setCreating(false); return; }
      refresh();
      setShowModal(false); setGroupName(''); setSubject(''); setDueDate(''); setSelectedLeadId(''); setCreating(false);
    } catch {
      setFormError('Failed to create group.');
      setCreating(false);
    }
  }

  const { evalSessions, evalCounts, evalScores, latestActivity, loading: analyticsLoading } = useCourseAnalytics(groupIds);

  const totalMembers = groups.reduce((s, g) => s + g.memberCount, 0);
  const totalTasks = groups.reduce((s, g) => s + g.taskTotal, 0);
  const totalDone = groups.reduce((s, g) => s + g.taskDone, 0);
  const completionPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const overdueCount = groups.filter(({ group, taskDone: done, taskTotal: total }) =>
    group.due_date && new Date(group.due_date + 'T00:00:00') < todayDate && done < total
  ).length;

  // Peer review rate: total distinct evaluators across all groups vs total members
  const totalEvaluators = Object.values(evalCounts).reduce((s, ids) => s + ids.length, 0);
  const peerReviewRate = totalMembers > 0 ? `${totalEvaluators} of ${totalMembers}` : '0 of 0';

  // Average peer score across all evaluations
  const avgPeerScore = useMemo(() => {
    if (evalScores.length === 0) return null;
    const total = evalScores.reduce((s, r) => s + r.contribution_score + r.collaboration_score, 0);
    return (total / (evalScores.length * 2)).toFixed(1);
  }, [evalScores]);

  // Session lookup by group_id
  const sessionByGroup = useMemo(() => {
    const map: Record<string, boolean> = {};
    evalSessions.forEach((s) => { map[s.group_id] = true; });
    return map;
  }, [evalSessions]);

  // Compute health status per group
  function getHealthStatus(group: Group, taskDone: number, taskTotal: number): GroupHealthStatus {
    const completionPct = taskTotal > 0 ? (taskDone / taskTotal) * 100 : 100;
    if (!group.due_date) return 'green';
    const due = new Date(group.due_date + 'T00:00:00');
    if (due < todayDate && completionPct < 100) return 'red';
    const daysLeft = Math.ceil((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (completionPct < 50 && daysLeft < 7) return 'amber';
    return 'green';
  }

  // Compute peer review label per group
  function getPeerReviewInfo(groupId: string, memberCount: number): { label: string; color: string } {
    const hasSession = sessionByGroup[groupId];
    const evaluators = evalCounts[groupId] ?? [];
    if (!hasSession) return { label: 'Not started', color: '#94A3B8' };
    if (evaluators.length === 0) return { label: 'Open', color: '#1A56E8' };
    return { label: `${evaluators.length}/${memberCount} submitted`, color: '#1A56E8' };
  }

  // Needs attention filter logic
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  function needsAttention(groupId: string, group: Group, taskDone: number, taskTotal: number, memberCount: number): boolean {
    // Overdue
    if (group.due_date && new Date(group.due_date + 'T00:00:00') < todayDate && taskDone < taskTotal) return true;
    // No activity in 3+ days
    const lastAct = latestActivity[groupId];
    if (lastAct && (todayDate.getTime() - new Date(lastAct).getTime()) >= THREE_DAYS_MS) return true;
    if (!lastAct && groups.length > 0) return true; // No activity at all
    // Peer review opened but <50% submitted
    const hasSession = sessionByGroup[groupId];
    const evaluators = evalCounts[groupId] ?? [];
    if (hasSession && memberCount > 0 && evaluators.length < memberCount * 0.5) return true;
    return false;
  }

  const filteredGroups = filterMode === 'all'
    ? groups
    : groups.filter(({ group, taskDone, taskTotal, memberCount }) =>
        needsAttention(group.id, group, taskDone, taskTotal, memberCount)
      );

  const attentionCount = groups.filter(({ group, taskDone, taskTotal, memberCount }) =>
    needsAttention(group.id, group, taskDone, taskTotal, memberCount)
  ).length;

  const totalBlockers = Object.values(blockerCounts).reduce((s, c) => s + c, 0);
  const inactiveGroupCount = groups.filter(({ group, taskTotal }) => {
    if (taskTotal === 0) return false; // brand-new group with no tasks is not stale
    const lastAct = latestActivity[group.id];
    if (!lastAct) return true;
    return (todayDate.getTime() - new Date(lastAct).getTime()) >= THREE_DAYS_MS;
  }).length;
  const showAlertBanner = overdueCount > 0 || inactiveGroupCount > 0 || totalBlockers > 0;

  if (loading || courseLoading) return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  if (!course) return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
      <p className="text-[15px] font-semibold text-text">Course not found</p>
      <a href="/teacher" className="text-sm text-brand hover:underline">Back to My Courses</a>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <TeacherNav
        profile={profile}
        title={course.name}
        backLabel="My Courses"
        onBack={() => router.push('/teacher')}
        onProfileUpdate={refreshProfile}
      />

      <div className="md:pl-[220px]">
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/teacher')} className="text-text-tertiary hover:text-brand text-sm transition-colors">My Courses</button>
            <span className="text-text-tertiary text-sm">/</span>
            <span className="text-base font-semibold text-text">{course.name}</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-9 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New group
          </button>
        </div>

        <div className="pt-16 md:pt-2 pb-4 px-4 py-4 max-w-2xl mx-auto">
          {/* Course invite link for students */}
          <div className="mb-4 p-3 bg-brand-light rounded-[8px] border border-[#93B4FF]">
            <p className="text-[11px] font-semibold text-brand-dark uppercase tracking-wide mb-0.5">Course invite link</p>
            <p className="text-[11px] text-[#3B5BCC] mb-1.5">Share with students to enroll them in this course, or with group leads to connect their group.</p>
            <p className="text-[12px] text-[#0E3AAF] break-all font-mono bg-white px-2 py-1.5 rounded-md border border-[#C5D5FF] mt-1">{inviteBase ? courseInviteLink : 'Loading…'}</p>
            {inviteBase && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => navigator.clipboard.writeText(courseInviteLink)}
                  className="text-[11px] text-brand-dark font-medium hover:underline"
                >
                  Copy link
                </button>
                {courseResetState === 'idle' && (
                  <button onClick={() => setCourseResetState('confirm')} className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors">
                    Reset link
                  </button>
                )}
                {courseResetState === 'confirm' && (
                  <span className="text-[11px] text-text-secondary flex items-center gap-2">
                    Revoke current link?
                    <button
                      onClick={async () => {
                        setCourseResetState('resetting');
                        const res = await fetch(`/api/courses/${courseId}/reset-invite`, { method: 'POST' });
                        if (res.ok) { refresh(); setCourseResetState('done'); setTimeout(() => setCourseResetState('idle'), 2000); }
                        else setCourseResetState('idle');
                      }}
                      className="text-red font-medium hover:underline"
                    >Confirm</button>
                    <button onClick={() => setCourseResetState('idle')} className="text-text-tertiary hover:underline">Cancel</button>
                  </span>
                )}
                {courseResetState === 'resetting' && <span className="text-[11px] text-text-tertiary">Resetting…</span>}
                {courseResetState === 'done' && <span className="text-[11px] text-green font-medium">Link reset</span>}
              </div>
            )}
          </div>

          {ungroupedStudents.length > 0 && (
            <div className="mb-4 p-3 bg-white border border-border rounded-xl">
              <p className="text-[13px] font-semibold text-text mb-0.5">Students without a group ({ungroupedStudents.length})</p>
              <p className="text-[11px] text-text-tertiary mb-2.5">These students have joined the course but haven&apos;t been added to a group yet.</p>
              <div className="flex flex-wrap gap-2">
                {ungroupedStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setAssigningStudent(s)}
                    className="inline-flex items-center gap-1.5 bg-brand-light text-brand text-[12px] font-medium px-2.5 py-1 rounded-full hover:bg-[#D6E4FF] transition-colors"
                  >
                    {s.name}
                    <span className="text-[10px] opacity-70">+</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <InlineTip id="teacher-attention">Groups flagged &quot;needs attention&quot; are overdue, inactive, or have unresolved blockers.</InlineTip>
          )}

          {groups.length > 0 && showAlertBanner && (
            <button
              onClick={() => setFilterMode('attention')}
              className="w-full mb-3 px-3 py-2.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg flex items-center gap-2 text-left transition-colors hover:bg-[#FDE68A]/50"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[#92400E]">
                <path d="M8 1.5L1.5 13h13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[13px] text-[#92400E] font-medium">
                {[
                  overdueCount > 0 ? `${overdueCount} group${overdueCount > 1 ? 's' : ''} overdue` : '',
                  inactiveGroupCount > 0 ? `${inactiveGroupCount} group${inactiveGroupCount > 1 ? 's' : ''} inactive (3+ days)` : '',
                  totalBlockers > 0 ? `${totalBlockers} unresolved blocker${totalBlockers > 1 ? 's' : ''}` : '',
                ].filter(Boolean).join(' \u00b7 ')}
              </span>
            </button>
          )}

          {groups.length > 0 && (
            <div className="flex gap-2.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'Groups',     value: groups.length,  color: '' },
                ...(ungroupedStudents.length > 0 ? [{ label: 'Enrolled', value: totalMembers + ungroupedStudents.length, color: '' }] : []),
                { label: 'In Groups',  value: totalMembers,   color: '' },
                { label: 'Completion', value: `${completionPct}%`, color: completionPct === 100 ? '#16A34A' : '' },
                ...(overdueCount > 0 ? [{ label: 'Overdue', value: overdueCount, color: '#DC2626' }] : []),
                { label: 'Peer Review', value: peerReviewRate, color: '' },
                ...(avgPeerScore !== null ? [{ label: 'Avg Score', value: avgPeerScore, color: '' }] : []),
              ].map((s) => (
                <div key={s.label} className="flex-shrink-0 bg-white border border-border rounded-xl px-3.5 py-2.5 min-w-[76px] shadow-sm">
                  <p className="text-lg font-bold" style={{ color: s.color || '#0F172A' }}>{s.value}</p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setFilterMode('all')}
                className={`text-[13px] font-medium px-2.5 py-1 rounded-md transition-colors ${filterMode === 'all' ? 'bg-[#EBF0FF] text-[#1A56E8]' : 'text-[#94A3B8] hover:text-[#0F172A]'}`}
              >
                Show all
              </button>
              <button
                onClick={() => setFilterMode('attention')}
                className={`text-[13px] font-medium px-2.5 py-1 rounded-md transition-colors ${filterMode === 'attention' ? 'bg-[#EBF0FF] text-[#1A56E8]' : 'text-[#94A3B8] hover:text-[#0F172A]'}`}
              >
                Needs attention{attentionCount > 0 ? ` (${attentionCount})` : ''}
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="py-8">
              <p className="text-[15px] font-bold text-text mb-1 text-center">No groups yet</p>
              <p className="text-sm text-text-tertiary mb-6 text-center max-w-xs mx-auto">Here&apos;s how to get started with your course:</p>
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                {[
                  { step: '1', title: 'Share the invite link', desc: 'Copy the course invite link above and send it to your students.' },
                  { step: '2', title: 'Students join and form groups', desc: 'Students enroll in the course, then create or join groups. You can also create groups and share group invite links.' },
                  { step: '3', title: 'Monitor & download records', desc: 'Track progress in real-time and export Contribution Records for grading.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 items-start bg-white border border-border rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-[#1240C4] text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{item.step}</div>
                    <div>
                      <p className="text-[14px] font-semibold text-text">{item.title}</p>
                      <p className="text-[13px] text-text-secondary mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-2">
              {filteredGroups.length === 0 && filterMode === 'attention' ? (
                <p className="text-sm text-[#94A3B8] text-center py-6">All groups are on track.</p>
              ) : (
                filteredGroups.map(({ group, taskTotal, taskDone, memberCount }) => {
                  const health = getHealthStatus(group, taskDone, taskTotal);
                  const prInfo = getPeerReviewInfo(group.id, memberCount);
                  return (
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
                      healthStatus={health}
                      peerReviewLabel={prInfo.label}
                      peerReviewColor={prInfo.color}
                      teacherIsLead={group.lead_id === user?.id}
                    />
                  );
                })
              )}
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
          onClick={(e) => { if (e.target === e.currentTarget && !savingGroup) setEditingGroup(null); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">Edit Group</h2>
              <button onClick={() => setEditingGroup(null)} className="text-text-secondary hover:text-text p-1">✕</button>
            </div>
            <form onSubmit={handleEditGroupSave} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Group name</label>
                <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} placeholder="e.g. Team Alpha"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Subject code</label>
                <input type="text" value={editGroupSubject} onChange={(e) => setEditGroupSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Due date <span className="font-normal text-text-tertiary">(optional)</span></label>
                <input type="date" value={editGroupDueDate} onChange={(e) => setEditGroupDueDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {editGroupError && <p className="text-sm text-red-500">{editGroupError}</p>}
              <div className="pt-1 border-t border-border">
                <button type="submit" disabled={savingGroup}
                  className="w-full h-11 bg-brand-dark hover:bg-[#0E3AAF] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
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
            <h2 className="text-[15px] font-semibold text-text mb-1">Archive group?</h2>
            <p className="text-sm text-text-secondary mb-5">This will archive the group. Students will no longer be able to access it. Tasks and activity history are preserved.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteGroupId(null)}
                className="flex-1 h-10 border border-border bg-white hover:bg-bg-hover text-[13px] font-medium text-text-secondary rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={!!deletingGroupId}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-60"
              >
                {deletingGroupId ? 'Archiving…' : 'Archive group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningStudent && (
        <AssignGroupModal
          student={{ id: assigningStudent.id, name: assigningStudent.name }}
          groups={groups.map(({ group, memberCount }) => ({ id: group.id, name: group.name, memberCount }))}
          onClose={() => setAssigningStudent(null)}
          onAssigned={() => { setAssigningStudent(null); refresh(); }}
        />
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget && !creating) { setShowModal(false); setSelectedLeadId(''); } }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-2xl md:rounded-xl">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">New Group</h2>
              <button onClick={() => { setShowModal(false); setSelectedLeadId(''); }} className="p-1 text-text-secondary hover:text-text transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Group name</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Team Alpha"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Subject code</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. MGT 402"
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-text-secondary">Due date <span className="font-normal text-text-tertiary">(optional)</span></label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white" />
              </div>
              {enrolledStudents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-text-secondary">Group lead <span className="font-normal text-text-tertiary">(optional)</span></label>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
                  >
                    <option value="">No lead yet — assign later</option>
                    {enrolledStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.university}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-tertiary">{selectedLeadId ? 'This student will manage the group.' : 'The first student to join will become the lead.'}</p>
                </div>
              ) : (
                <div className="bg-brand-light rounded-md px-3 py-2.5 border border-[#C5D5FF]">
                  <p className="text-[12px] text-[#3B5BCC]">You'll be the temporary lead until a student joins or is added.</p>
                </div>
              )}
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="pt-1 border-t border-border">
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireTeacher(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
