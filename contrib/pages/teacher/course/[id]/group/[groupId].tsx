import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import Nav from '@/components/nav';
import FeedItem from '@/components/feed-item';
import MemberRow from '@/components/member-row';
import EvidenceList from '@/components/evidence-list';
import { IconExport } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useCourse } from '@/hooks/use-course';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { useActivity } from '@/hooks/use-activity';
import { useGroupEvidence } from '@/hooks/use-group-evidence';
import { useEvaluationSession } from '@/hooks/use-evaluation-session';
import { useEvaluationSummaries } from '@/hooks/use-evaluation-summaries';
import { generateReport } from '@/lib/pdf';
import type { Task, TaskStatus, Evidence } from '@/types';

type Tab = 'tasks' | 'activity' | 'members' | 'peer-review';

const STATUS_COLS: { status: TaskStatus; label: string; headerClass: string; countClass: string }[] = [
  { status: 'todo',       label: 'To Do',      headerClass: 'text-[#57534E]', countClass: 'bg-[#E8E5E3] text-[#57534E]' },
  { status: 'inprogress', label: 'In Progress', headerClass: 'text-[#B45309]', countClass: 'bg-[#FDE68A] text-[#92400E]' },
  { status: 'done',       label: 'Done',        headerClass: 'text-[#15803D]', countClass: 'bg-[#BBF7D0] text-[#15803D]' },
];

export default function TeacherGroupDetail() {
  const router = useRouter();
  const courseId = typeof router.query.id === 'string' ? router.query.id : undefined;
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : undefined;

  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const { course, isOwner, loading: courseLoading } = useCourse(courseId, user?.id);
  const { group, members, loading: groupLoading } = useGroup(groupId, user?.id);
  const { tasks } = useTasks(groupId);
  const { activity } = useActivity(groupId);
  const taskIds = tasks.map((t) => t.id);
  const { evidenceByTask } = useGroupEvidence(taskIds);
  const { session: evalSession } = useEvaluationSession(groupId);
  const { summaries: evalSummaries } = useEvaluationSummaries(groupId, !!evalSession);

  const [tab, setTab] = useState<Tab>('tasks');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) { router.replace('/login'); return; }
    if (!userLoading && profile && profile.role !== 'teacher') router.replace('/dashboard');
  }, [user, profile, userLoading, router]);

  useEffect(() => {
    if (!courseLoading && course && !isOwner) router.replace('/teacher');
  }, [course, isOwner, courseLoading, router]);

  async function handleDownloadPdf() {
    if (!group || !members.length) return;
    setDownloading(true);
    const { data: evidenceData } = await supabase
      .from('evidence')
      .select('*, uploader:profiles!evidence_uploaded_by_fkey(*)')
      .in('task_id', taskIds.length > 0 ? taskIds : ['00000000-0000-0000-0000-000000000000']);
    const byTask: Record<string, Evidence[]> = {};
    ((evidenceData as Evidence[]) ?? []).forEach((e) => {
      if (!byTask[e.task_id]) byTask[e.task_id] = [];
      byTask[e.task_id].push(e);
    });
    generateReport(group, members, tasks, activity, byTask, evalSummaries);
    setDownloading(false);
  }

  const loading = userLoading || courseLoading || groupLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="spinner" style={{ borderTopColor: '#1240C4' }} />
      </div>
    );
  }

  if (!group || !course) return null;

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} role="teacher" onProfileUpdate={refreshProfile} />

      <div className="md:pl-[220px]">

        {/* Desktop breadcrumb + export */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => router.push('/teacher')}
              className="text-[#A8A29E] hover:text-[#1C1917] transition-colors"
            >
              My Courses
            </button>
            <span className="text-[#A8A29E]">/</span>
            <button
              onClick={() => router.push(`/teacher/course/${courseId}`)}
              className="text-[#A8A29E] hover:text-[#1C1917] transition-colors"
            >
              {course.name}
            </button>
            <span className="text-[#A8A29E]">/</span>
            <span className="font-semibold text-[#1C1917]">{group.name}</span>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <IconExport size={14} />
            {downloading ? 'Exporting…' : 'Export Contribution Record'}
          </button>
        </div>

        {/* Mobile header */}
        <div className="md:hidden px-4 pt-14 pb-3 bg-white border-b border-[#E7E5E4]">
          <button
            onClick={() => router.push(`/teacher/course/${courseId}`)}
            className="text-[12px] text-[#A8A29E] mb-1 flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {course.name}
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-[17px] font-bold text-[#1C1917]">{group.name}</h1>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="h-8 px-3 border border-[#E7E5E4] bg-white text-[12px] font-medium rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconExport size={13} />
              PDF
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E7E5E4] bg-white overflow-x-auto">
          {(['tasks', 'activity', 'members', 'peer-review'] as Tab[]).map((t) => {
            const label = t === 'tasks' ? 'Tasks' : t === 'activity' ? 'Timeline' : t === 'members' ? 'Members' : 'Peer Review';
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  tab === t
                    ? 'border-[#1240C4] text-[#1240C4]'
                    : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">

          {/* ── Tasks ── */}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-5">
              {tasks.length === 0 && (
                <p className="text-[14px] text-[#A8A29E] text-center py-10">No tasks yet</p>
              )}
              {STATUS_COLS.map(({ status, label, headerClass, countClass }) => {
                const filtered = tasks.filter((t) => t.status === status);
                if (filtered.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[12px] font-semibold uppercase tracking-wide ${headerClass}`}>{label}</span>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${countClass}`}>{filtered.length}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {filtered.map((task) => {
                        const evidenceCount = (evidenceByTask[task.id] ?? []).length;
                        return (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="w-full text-left bg-white border border-[#E7E5E4] rounded-[8px] px-3 py-2.5 hover:border-[#1240C4]/40 hover:shadow-sm transition-all"
                            style={{ boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#EEF2FF] text-[#1240C4] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {(task.assignee?.name ?? '?').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-[13px] font-medium text-[#1C1917] flex-1 truncate">{task.title}</span>
                              {evidenceCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#1240C4] flex-shrink-0">
                                  {evidenceCount} ev
                                </span>
                              )}
                              {task.due_date && (
                                <span className="text-[11px] text-[#A8A29E] flex-shrink-0">
                                  {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Timeline ── */}
          {tab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <p className="text-[14px] text-[#A8A29E] text-center py-10">No activity yet</p>
              ) : (
                activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)
              )}
            </div>
          )}

          {/* ── Members ── */}
          {tab === 'members' && (
            <div>
              {members.length === 0 ? (
                <p className="text-[14px] text-[#A8A29E] text-center py-10">No members</p>
              ) : (
                members.map((m) => {
                  const summary = evalSummaries.find((s) => s.evaluatee_id === m.profile_id);
                  return (
                    <div key={m.id}>
                      <MemberRow
                        member={m}
                        tasks={tasks}
                        isThisMemberLead={m.profile_id === group.lead_id}
                        canRemove={false}
                      />
                      {summary && (
                        <div className="flex gap-2 pb-2 pl-12 -mt-1 flex-wrap">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#1240C4]">
                            Contribution {summary.avg_contribution.toFixed(1)}/5
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#1240C4]">
                            Collaboration {summary.avg_collaboration.toFixed(1)}/5
                          </span>
                          <span className="text-[11px] text-[#A8A29E]">
                            {summary.eval_count} review{summary.eval_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Peer Review ── */}
          {tab === 'peer-review' && (
            <div>
              {!evalSession ? (
                <div className="text-center py-10">
                  <p className="text-[14px] font-medium text-[#1C1917]">Peer review not opened</p>
                  <p className="text-[13px] text-[#A8A29E] mt-1">The group lead has not opened peer review for this group yet.</p>
                </div>
              ) : evalSummaries.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[14px] font-medium text-[#1C1917]">No submissions yet</p>
                  <p className="text-[13px] text-[#A8A29E] mt-1">Students have not submitted their peer reviews yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E7E5E4]">
                        <th className="py-2.5 pr-4 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide">Member</th>
                        <th className="py-2.5 pr-4 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide">Contribution</th>
                        <th className="py-2.5 pr-4 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide">Collaboration</th>
                        <th className="py-2.5 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide">Reviews</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalSummaries.map((s) => {
                        const member = members.find((m) => m.profile_id === s.evaluatee_id);
                        const name = member?.profile?.name ?? '—';
                        return (
                          <tr key={s.evaluatee_id} className="border-b border-[#E7E5E4] last:border-none">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#EEF2FF] text-[#1240C4] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                  {name.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[13px] font-medium text-[#1C1917]">{name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-[13px] font-semibold text-[#1240C4]">{s.avg_contribution.toFixed(1)}</span>
                              <span className="text-[11px] text-[#A8A29E]">/5</span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-[13px] font-semibold text-[#1240C4]">{s.avg_collaboration.toFixed(1)}</span>
                              <span className="text-[11px] text-[#A8A29E]">/5</span>
                            </td>
                            <td className="py-3">
                              <span className="text-[13px] text-[#57534E]">{s.eval_count}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Read-only Task Detail Sheet */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}
        >
          <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px] max-h-[80dvh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4] sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-[#1C1917] truncate pr-4">{selectedTask.title}</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-[#57534E] hover:text-[#1C1917] p-1 flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {/* Status + assignee */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                  selectedTask.status === 'done' ? 'bg-[#DCFCE7] text-[#15803D]' :
                  selectedTask.status === 'inprogress' ? 'bg-[#FEF3C7] text-[#B45309]' :
                  'bg-[#F5F5F4] text-[#57534E]'
                }`}>
                  {selectedTask.status === 'todo' ? 'To Do' : selectedTask.status === 'inprogress' ? 'In Progress' : 'Done'}
                </span>
                {selectedTask.assignee && (
                  <span className="text-[12px] text-[#57534E]">
                    Assigned to <span className="font-medium">{selectedTask.assignee.name}</span>
                  </span>
                )}
              </div>

              {/* Due date */}
              {selectedTask.due_date && (
                <p className="text-[13px] text-[#57534E]">
                  Due{' '}
                  <span className="font-medium">
                    {new Date(selectedTask.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </p>
              )}

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <p className="text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide mb-1.5">Description</p>
                  <p className="text-[13px] text-[#1C1917] leading-relaxed">{selectedTask.description}</p>
                </div>
              )}

              {/* Evidence */}
              <div>
                <p className="text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wide mb-2">Evidence</p>
                {(evidenceByTask[selectedTask.id] ?? []).length > 0 ? (
                  <EvidenceList evidence={evidenceByTask[selectedTask.id]} />
                ) : (
                  <p className="text-[13px] text-[#A8A29E]">No evidence logged yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
