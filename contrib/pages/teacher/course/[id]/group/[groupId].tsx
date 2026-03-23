import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import TaskCard from '@/components/task-card';
import FeedItem from '@/components/feed-item';
import MemberRow from '@/components/member-row';
import EvaluationResults from '@/components/evaluation-results';
import { IconExport, IconBoard, IconActivity, IconUsers, IconList, IconCheck } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { useActivity } from '@/hooks/use-activity';
import { useGroupEvidence } from '@/hooks/use-group-evidence';
import { useEvaluationSession } from '@/hooks/use-evaluation-session';
import { useEvaluationSummaries } from '@/hooks/use-evaluation-summaries';
import { generateReport, DEFAULT_PDF_THEME } from '@/lib/pdf';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import type { Group, GroupMember, Task, ActivityLog } from '@/types';

type Tab = 'tasks' | 'activity' | 'members' | 'evaluation';

const STATUS_COLS: { status: string; label: string; countClass: string; headerClass: string }[] = [
  { status: 'todo',       label: 'To Do',       countClass: 'bg-[#E8E5E3] text-[#475569]',  headerClass: 'bg-[#F1F5F9] text-[#475569]' },
  { status: 'inprogress', label: 'In Progress',  countClass: 'bg-[#FDE68A] text-[#92400E]', headerClass: 'bg-[#FEF3C7] text-[#B45309]' },
  { status: 'done',       label: 'Done',         countClass: 'bg-[#BBF7D0] text-[#15803D]', headerClass: 'bg-[#DCFCE7] text-[#15803D]' },
];

export default function TeacherGroupDetail() {
  const router = useRouter();
  const courseId = typeof router.query.id === 'string' ? router.query.id : undefined;
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : undefined;

  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const { group, members, loading: groupLoading } = useGroup(groupId, user?.id);
  const { tasks } = useTasks(groupId);
  const { activity } = useActivity(groupId);
  const taskIds = tasks.map((t) => t.id);
  const { evidenceByTask } = useGroupEvidence(taskIds);
  const { session: evalSession } = useEvaluationSession(groupId);
  const { summaries: evalSummaries } = useEvaluationSummaries(groupId, !!evalSession);

  const [tab, setTab] = useState<Tab>('tasks');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) { router.replace('/login'); return; }
    if (!userLoading && user && (!profile || profile.role !== 'teacher')) router.replace('/dashboard');
  }, [user, profile, userLoading, router]);

  useEffect(() => {
    if (!courseId || !user) return;
    supabase.from('courses').select('name, teacher_id').eq('id', courseId).single().then(({ data }) => {
      if (!data) { router.replace('/teacher'); return; }
      if (data.teacher_id !== user.id) { router.replace('/teacher'); return; }
      setCourseName(data.name);
      setIsOwner(true);
    });
  }, [courseId, user, router]);

  async function handleDownloadPdf() {
    if (!group) return;
    setDownloadingPdf(true);
    const [{ data: membersData }, { data: tasksData }, { data: activityData }] = await Promise.all([
      supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', group.id).order('joined_at', { ascending: true }),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(*)').eq('group_id', group.id).order('created_at', { ascending: false }),
    ]);
    generateReport(
      group,
      (membersData as GroupMember[]) ?? [],
      (tasksData as Task[]) ?? [],
      (activityData as ActivityLog[]) ?? [],
      evidenceByTask,
      evalSummaries,
      DEFAULT_PDF_THEME,
    );
    setDownloadingPdf(false);
  }

  if (userLoading || groupLoading) {
    return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  }

  if (!group || !isOwner) return null;

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <Nav
        profile={profile}
        role="teacher"
        group={group}
        backLabel={courseName || 'Course'}
        onBack={() => router.push(`/teacher/course/${courseId}`)}
        onProfileUpdate={refreshProfile}
      />

      <div className="md:pl-[220px]">
        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => router.push('/teacher')} className="text-[#94A3B8] hover:text-[#475569] transition-colors">
              My Courses
            </button>
            <span className="text-[#CBD5E1]">›</span>
            <button onClick={() => router.push(`/teacher/course/${courseId}`)} className="text-[#94A3B8] hover:text-[#475569] transition-colors">
              {courseName || '…'}
            </button>
            <span className="text-[#CBD5E1]">›</span>
            <span className="font-semibold text-[#0F172A]">{group.name}</span>
            <span className="text-[#94A3B8]">{group.subject}</span>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="h-8 px-3 border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <IconExport size={14} /> {downloadingPdf ? 'Exporting…' : 'Export Contribution Record'}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E2E8F0] bg-white sticky top-14 md:top-0 z-40 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(['tasks', 'activity', 'members', 'evaluation'] as Tab[]).map((t) => {
            const tabLabels: Record<Tab, string> = { tasks: 'Tasks', activity: 'Timeline', members: 'Members', evaluation: 'Peer Review' };
            return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t ? 'text-brand border-brand' : 'text-[#94A3B8] border-transparent'
              }`}
            >
              {tabLabels[t]}
            </button>
            );
          })}
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
            {/* Stats row */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'Total tasks', value: tasks.length,                                        color: '' },
                { label: 'Done',        value: tasks.filter(t => t.status === 'done').length,       color: '#16A34A' },
                { label: 'In progress', value: tasks.filter(t => t.status === 'inprogress').length, color: '#D97706' },
                { label: 'To do',       value: tasks.filter(t => t.status === 'todo').length,       color: '#94A3B8' },
              ].map((s) => (
                <div key={s.label} className="flex-shrink-0 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 min-w-[80px] shadow-sm">
                  <p className="text-lg font-bold" style={{ color: s.color || '#0F172A' }}>{s.value}</p>
                  <p className="text-[12px] text-[#94A3B8] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mobile: flat list */}
            <div className="md:hidden">
              {tasks.length === 0
                ? <p className="text-sm text-[#94A3B8] text-center py-8">No tasks yet.</p>
                : tasks.map((task) => (
                    <TaskCard key={task.id} task={task} isLead={false} currentUserId=""
                      evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                      onClick={() => {}} onEdit={() => {}} onDelete={() => {}}
                    />
                  ))
              }
            </div>

            {/* Desktop: kanban */}
            <div className="hidden md:grid grid-cols-3 gap-4">
              {tasks.length === 0
                ? <p className="col-span-3 text-sm text-[#94A3B8] text-center py-8">No tasks yet.</p>
                : STATUS_COLS.map((col) => {
                    const colTasks = tasks.filter(t => t.status === col.status);
                    return (
                      <div key={col.status}>
                        <div className={`flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-full w-fit ${col.headerClass}`}>
                          {col.status === 'todo'       && <IconList size={13} />}
                          {col.status === 'inprogress' && <IconActivity size={13} />}
                          {col.status === 'done'       && <IconCheck size={13} />}
                          <span className="text-[11px] font-bold uppercase tracking-wider">{col.label}</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${col.countClass}`}>{colTasks.length}</span>
                        </div>
                        {colTasks.length === 0 ? (
                          <div className="flex items-center justify-center py-8 border-2 border-dashed border-[#E2E8F0] rounded-xl">
                            <p className="text-[12px] text-[#C4C0BB]">No tasks here</p>
                          </div>
                        ) : colTasks.map((task) => (
                          <TaskCard key={task.id} task={task} isLead={false} currentUserId=""
                            evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                            onClick={() => {}} onEdit={() => {}} onDelete={() => {}}
                          />
                        ))}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">Recent activity</p>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <svg viewBox="0 0 120 90" fill="none" className="w-28 mx-auto mb-4 opacity-80">
                  <ellipse cx="60" cy="82" rx="44" ry="6" fill="#F1F5F9"/>
                  <circle cx="60" cy="42" r="28" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2"/>
                  <circle cx="60" cy="42" r="22" fill="white"/>
                  <line x1="60" y1="42" x2="60" y2="26" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="60" y1="42" x2="70" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="60" cy="42" r="2.5" fill="#94A3B8"/>
                  <line x1="60" y1="22" x2="60" y2="25" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="60" y1="59" x2="60" y2="62" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="40" y1="42" x2="43" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="77" y1="42" x2="80" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[14px] font-semibold text-[#475569] mb-1">No activity yet</p>
                <p className="text-sm text-[#94A3B8]">Actions will appear here as students work.</p>
              </div>
            ) : activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                tasks={tasks}
                isThisMemberLead={m.profile_id === group.lead_id}
                canRemove={false}
              />
            ))}
          </div>
        )}

        {/* ── EVALUATION TAB ── */}
        {tab === 'evaluation' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            {!evalSession ? (
              <div className="flex flex-col items-center py-14 text-center gap-2">
                <svg viewBox="0 0 80 80" fill="none" className="w-20 mx-auto mb-2">
                  <circle cx="40" cy="40" r="32" fill="#F0FDFA" stroke="#A5F3FC" strokeWidth="2"/>
                  <path d="M28 40h24M40 28v24" stroke="#0E7490" strokeWidth="2.5" strokeLinecap="round" opacity=".3"/>
                  <circle cx="40" cy="40" r="6" fill="#0E7490" opacity=".4"/>
                </svg>
                <p className="text-[15px] font-semibold text-[#0F172A]">Evaluation not started</p>
                <p className="text-sm text-[#94A3B8] max-w-xs">
                  Peer evaluation hasn&apos;t been opened yet. The group lead opens it when all tasks are done.
                </p>
              </div>
            ) : (
              <EvaluationResults
                summaries={evalSummaries}
                members={members}
                currentUserId={user?.id ?? ''}
                memberCount={members.length}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#E2E8F0] flex"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {([
          { id: 'tasks',      label: 'Tasks',    icon: <IconBoard size={22} /> },
          { id: 'activity',   label: 'Timeline', icon: <IconActivity size={22} /> },
          { id: 'members',    label: 'Members',  icon: <IconUsers size={22} /> },
          { id: 'evaluation', label: 'Review',   icon: <IconCheck size={22} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              tab === item.id ? 'text-brand' : 'text-[#94A3B8]'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
