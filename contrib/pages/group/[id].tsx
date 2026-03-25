import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { supabase } from '@/lib/supabase';
import { requireStudent } from '@/lib/supabase-server';
import Nav from '@/components/nav';
import TaskCard from '@/components/task-card';
import TaskModal from '@/components/task-modal';
import TaskForm from '@/components/task-form';
import EditTaskModal from '@/components/edit-task-modal';
import EditGroupModal from '@/components/edit-group-modal';
import TransferLeadModal from '@/components/transfer-lead-modal';
import ConfirmModal from '@/components/confirm-modal';
import FeedItem from '@/components/feed-item';
import MemberRow from '@/components/member-row';
import InviteBanner from '@/components/invite-banner';
import EvaluationForm from '@/components/evaluation-form';
import EvaluationResults from '@/components/evaluation-results';
import TaskBoardSkeleton from '@/components/task-skeleton';
import { IconPlus, IconExport, IconPencil, IconTrash, IconHome, IconBoard, IconActivity, IconUsers, IconList, IconCheck, IconLink, IconCopy } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { useActivity } from '@/hooks/use-activity';
import { useGroupEvidence } from '@/hooks/use-group-evidence';
import { useEvaluationSession } from '@/hooks/use-evaluation-session';
import { useEvaluation } from '@/hooks/use-evaluation';
import { useEvaluationSummaries } from '@/hooks/use-evaluation-summaries';
import { generateReport, DEFAULT_PDF_THEME } from '@/lib/pdf';
import type { Task, TaskStatus, GroupMember, Evaluation } from '@/types';

const PDF_THEMES: { label: string; color: [number, number, number] }[] = [
  { label: 'Coral',  color: [255, 88,  65]  },
  { label: 'Navy',   color: [30,  64,  175] },
  { label: 'Forest', color: [22,  101, 52]  },
  { label: 'Slate',  color: [71,  85,  105] },
  { label: 'Amber',  color: [180, 83,  9]   },
  { label: 'Plum',   color: [126, 34,  206] },
];

type Tab = 'tasks' | 'activity' | 'members' | 'evaluation';
type EvaluationInsert = Omit<Evaluation, 'id' | 'submitted_at'>;
type StatusFilter = 'all' | TaskStatus;

const STATUS_COLS: { status: TaskStatus; label: string; countClass: string; headerClass: string }[] = [
  { status: 'todo',       label: 'To Do',      countClass: 'bg-[#E2E8F0] text-[#475569]',  headerClass: 'bg-[#F1F5F9] text-[#475569]' },
  { status: 'inprogress', label: 'In Progress', countClass: 'bg-[#FDE68A] text-[#92400E]', headerClass: 'bg-[#FEF3C7] text-[#B45309]' },
  { status: 'done',       label: 'Done',        countClass: 'bg-[#BBF7D0] text-[#15803D]', headerClass: 'bg-[#DCFCE7] text-[#15803D]' },
];

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;
  const groupId = typeof id === 'string' ? id : undefined;

  const { user, profile, loading: userLoading } = useUser();
  const { group, members, isLead, loading: groupLoading, refresh: refreshGroup } = useGroup(groupId, user?.id);
  const { tasks, loading: tasksLoading, refresh: refreshTasks } = useTasks(groupId);
  const { activity, refresh: refreshActivity } = useActivity(groupId);
  const taskIds = tasks.map((t) => t.id);
  const { evidenceByTask, refresh: refreshEvidence } = useGroupEvidence(taskIds);
  const { session: evalSession, loading: evalSessionLoading, openEvaluation, resetEvaluation, refresh: refreshEvalSession } = useEvaluationSession(groupId);
  const { hasSubmitted, submit: submitEvaluation, refresh: refreshEvalSubmit } = useEvaluation(groupId, user?.id);
  const { summaries: evalSummaries, refresh: refreshSummaries } = useEvaluationSummaries(groupId, !!evalSession);

  const [pdfTheme, setPdfTheme] = useState<[number, number, number]>(DEFAULT_PDF_THEME);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [tab, setTab] = useState<Tab>('tasks');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [showTransferLead, setShowTransferLead] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [showResetEval, setShowResetEval] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/signup');
  }, [user, userLoading, router]);

  function handleDeleteTaskClick(task: Task) {
    setTaskToDelete(task);
  }

  function showToast(msg: string, type: 'error' | 'success' = 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function executeDeleteTask() {
    if (!taskToDelete || !user) return;
    try {
      await supabase.from('activity_log').insert({
        group_id: taskToDelete.group_id,
        actor_id: user.id,
        action: 'task_deleted',
        task_id: taskToDelete.id,
        meta: { task_title: taskToDelete.title },
      });
      const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskToDelete.id);
      if (error) throw error;
      setTaskToDelete(null);
      refreshTasks();
      refreshActivity();
    } catch { showToast('Failed to delete task. Please try again.'); }
  }

  async function executeDeleteGroup() {
    if (!group || !isLead) return;
    try {
      const { error } = await supabase.from('groups').delete().eq('id', group.id);
      if (error) throw error;
      router.push('/dashboard');
    } catch { showToast('Failed to delete group. Please try again.'); }
  }

  async function executeLeaveGroup() {
    if (!user || !group) return;
    const myMembership = members.find((m) => m.profile_id === user.id);
    if (!myMembership) return;
    try {
      await supabase.from('activity_log').insert({
        group_id: group.id,
        actor_id: user.id,
        action: 'member_left',
        task_id: null,
        meta: null,
      });
      const { error } = await supabase.from('group_members').delete().eq('id', myMembership.id);
      if (error) throw error;
      router.push('/dashboard');
    } catch { showToast('Failed to leave group. Please try again.'); }
  }

  async function executeRemoveMember() {
    if (!memberToRemove || !user || !group || !isLead) return;
    try {
      await supabase.from('activity_log').insert({
        group_id: group.id,
        actor_id: user.id,
        action: 'member_removed',
        task_id: null,
        meta: { removed_name: memberToRemove.profile?.name ?? '' },
      });
      const { error } = await supabase.from('group_members').delete().eq('id', memberToRemove.id);
      if (error) throw error;
      setMemberToRemove(null);
      refreshGroup();
      refreshActivity();
    } catch { showToast('Failed to remove member. Please try again.'); }
  }

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  function handleExport() {
    if (!group) return;
    generateReport(group, members, tasks, activity, evidenceByTask, [], pdfTheme, 'student');
    // Log export
    if (user) {
      supabase.from('activity_log').insert({
        group_id: group.id, actor_id: user.id, action: 'report_exported',
        task_id: null, meta: { mode: 'student' },
      });
    }
  }

  async function handleShareLink() {
    if (!group || !user || shareLoading) return;
    setShareLoading(true);
    try {
      const res = await fetch('/api/report/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id }),
      });
      if (!res.ok) { showToast('Failed to create share link.'); return; }
      const data = await res.json();
      setShareUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      showToast('Link copied to clipboard!', 'success');
      // Log share
      if (!data.existing) {
        await supabase.from('activity_log').insert({
          group_id: group.id, actor_id: user.id, action: 'report_shared',
          task_id: null, meta: { token: data.token },
        });
        refreshActivity();
      }
    } catch { showToast('Failed to create share link.'); }
    finally { setShareLoading(false); }
  }

  async function handleRevokeShare() {
    if (!group || !user) return;
    try {
      const res = await fetch(`/api/report/share?group_id=${group.id}`, { method: 'DELETE' });
      if (!res.ok) { showToast('Failed to revoke link.'); return; }
      setShareUrl(null);
      showToast('Share link revoked.', 'success');
    } catch { showToast('Failed to revoke link.'); }
  }

  // Fetch existing share link on load
  useEffect(() => {
    if (!groupId || !isLead) return;
    fetch(`/api/report/share?group_id=${groupId}`)
      .then((r) => r.json())
      .then((d) => { if (d.share) setShareUrl(`${window.location.origin}/report/${d.share.token}`); })
      .catch(() => {});
  }, [groupId, isLead]);

  async function handleOpenEvaluation() {
    if (!groupId || !user) return;
    try {
      await openEvaluation(groupId, user.id);
      await supabase.from('activity_log').insert({
        group_id: groupId,
        actor_id: user.id,
        action: 'evaluation_opened',
        task_id: null,
        meta: null,
      });
      refreshActivity();
    } catch { showToast('Failed to open peer review. Please try again.'); }
  }

  async function executeResetEvaluation() {
    if (!groupId) return;
    try {
      await resetEvaluation(groupId);
      refreshEvalSession();
      refreshEvalSubmit();
      setShowResetEval(false);
    } catch { showToast('Failed to reset peer review. Please try again.'); }
  }

  async function handleSubmitEvaluation(entries: EvaluationInsert[]) {
    if (!groupId || !user) return;
    try {
      await submitEvaluation(entries);
      await supabase.from('activity_log').insert({
        group_id: groupId,
        actor_id: user.id,
        action: 'evaluation_submitted',
        task_id: null,
        meta: null,
      });
      refreshSummaries();
      refreshActivity();
    } catch { showToast('Failed to submit evaluation. Please try again.'); }
  }

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
  const isMember = members.some((m) => m.profile_id === user?.id);

  // ── Swipe navigation between tabs ──
  const TABS: Tab[] = ['tasks', 'activity', 'members', 'evaluation'];
  const touchRef = useRef({ x: 0, y: 0, active: false });
  const anyModalOpen = !!(selectedTask || showNewTask || editingTask || taskToDelete || showEditGroup || showDeleteGroup || showTransferLead || showLeaveConfirm || memberToRemove || showResetEval);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
    }
    function onEnd(e: TouchEvent) {
      if (!touchRef.current.active) return;
      touchRef.current.active = false;
      const dx = e.changedTouches[0].clientX - touchRef.current.x;
      const dy = e.changedTouches[0].clientY - touchRef.current.y;
      if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      setTab((prev) => {
        const idx = TABS.indexOf(prev);
        const next = idx + (dx < 0 ? 1 : -1);
        if (next < 0 || next >= TABS.length) return prev;
        return TABS[next];
      });
    }
    if (anyModalOpen) return; // Don't register swipe handlers when modals are open
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [anyModalOpen]);

  if (userLoading || groupLoading) {
    return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  }

  if (!user || !group || !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 text-[#475569]">
        <p>Group not found or you are not a member.</p>
        <button onClick={() => router.push('/dashboard')} className="text-brand text-sm">← Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <Nav profile={profile} group={group} onTabChange={(t) => setTab(t as Tab)} activeTab={tab} />

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out] ${
          toast.type === 'error' ? 'bg-[#DC2626] text-white' : 'bg-[#16A34A] text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="pt-14 md:pt-0 md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => router.push('/dashboard')} className="text-[#94A3B8] hover:text-[#475569] transition-colors">
              My Groups
            </button>
            <span className="text-[#CBD5E1]">›</span>
            <span className="font-semibold text-[#0F172A]">{group.name}</span>
            <span className="text-[#94A3B8]">{group.subject}</span>
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={() => setShowEditGroup(true)} className="p-1.5 text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] rounded-md transition-colors" title="Edit group">
                <IconPencil size={13} />
              </button>
              {isLead && (
                <button onClick={() => setShowDeleteGroup(true)} className="p-1.5 text-[#94A3B8] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete group">
                  <IconTrash size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewTask(true)} className="h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
              <IconPlus size={14} /> Add task
            </button>
          </div>
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
            {/* Peer review status banner */}
            {evalSession && !hasSubmitted && (
              <div className="bg-brand-light border border-brand-border rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-[#0F172A]">Peer Review is open — submit your ratings</p>
                <button onClick={() => setTab('evaluation')}
                  className="flex-shrink-0 h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors">
                  Go to Review
                </button>
              </div>
            )}
            {evalSession && hasSubmitted && (
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
                <IconCheck size={14} />
                <p className="text-sm text-[#15803D]">Peer Review submitted — {evalSummaries.length > 0 ? `${Math.max(...evalSummaries.map(s => s.eval_count))}/${members.length - 1} responded` : 'waiting for others'}</p>
              </div>
            )}

            {/* All-tasks-done evaluation nudge (lead only, evaluation not yet open) */}
            {isLead && !evalSessionLoading && !evalSession && tasks.length > 0 && tasks.every((t) => t.status === 'done') && (
              <div className="bg-[#EBF0FF] border border-[#93B4FF] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-[#0F172A]">All tasks complete — ready for peer review?</p>
                <button onClick={handleOpenEvaluation}
                  className="flex-shrink-0 h-8 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md transition-colors">
                  Open Peer Review
                </button>
              </div>
            )}

            {/* Contribution Record — lead only */}
            {isLead && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Contribution Record</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Share or download your group&apos;s contribution record</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleShareLink} disabled={shareLoading}
                      className="h-8 px-3 border border-[#E2E8F0] bg-[#F8FAFF] hover:bg-[#F1F5F9] text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60">
                      <IconLink size={14} /> {shareLoading ? 'Sharing...' : 'Share Link'}
                    </button>
                    <button onClick={handleExport}
                      className="h-8 px-3 border border-[#E2E8F0] bg-[#F8FAFF] hover:bg-[#F1F5F9] text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
                      <IconExport size={14} /> Download PDF
                    </button>
                  </div>
                </div>
                {shareUrl && (
                  <div className="mt-2.5 flex items-center gap-2 bg-[#F8FAFF] border border-[#E2E8F0] rounded-md px-3 py-2">
                    <p className="text-[12px] text-[#64748B] truncate flex-1">{shareUrl}</p>
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('Link copied!', 'success'); }}
                      className="flex-shrink-0 p-1 text-[#64748B] hover:text-[#0F172A] transition-colors" title="Copy link">
                      <IconCopy size={14} />
                    </button>
                    <button onClick={handleRevokeShare}
                      className="flex-shrink-0 text-[11px] text-[#DC2626] hover:text-[#B91C1C] font-medium transition-colors">
                      Revoke
                    </button>
                  </div>
                )}
                <div className="flex gap-1.5 mt-2.5">
                  {PDF_THEMES.map((t) => {
                    const isActive = pdfTheme.join() === t.color.join();
                    return (
                      <button key={t.label} title={t.label} onClick={() => setPdfTheme(t.color)}
                        className={`w-5 h-5 rounded-full transition-all ${isActive ? 'ring-2 ring-offset-1 ring-[#0F172A]' : 'opacity-50 hover:opacity-100'}`}
                        style={{ backgroundColor: `rgb(${t.color.join(',')})` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Task board skeleton while loading */}
            {tasksLoading ? <TaskBoardSkeleton /> : <>

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

            {/* Mobile: status filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto md:hidden" style={{ scrollbarWidth: 'none' }}>
              {(['all', 'todo', 'inprogress', 'done'] as StatusFilter[]).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    statusFilter === s ? 'bg-brand-light text-brand border-brand-border' : 'bg-white text-[#475569] border-[#E2E8F0]'
                  }`}
                >
                  {{ all: `All (${tasks.length})`, todo: `To Do (${tasks.filter(t=>t.status==='todo').length})`, inprogress: `In Progress (${tasks.filter(t=>t.status==='inprogress').length})`, done: `Done (${tasks.filter(t=>t.status==='done').length})` }[s]}
                </button>
              ))}
            </div>

            {/* Mobile: flat list */}
            <div className="md:hidden">
              {tasks.length === 0
                ? <p className="text-sm text-[#94A3B8] text-center py-8">No tasks yet. Add your first task to get started.</p>
                : filteredTasks.length === 0
                ? <p className="text-sm text-[#94A3B8] text-center py-8">No tasks here.</p>
                : filteredTasks.map((task) => (
                    <TaskCard key={task.id} task={task} isLead={isLead} currentUserId={user!.id}
                      evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                      onClick={setSelectedTask} onEdit={setEditingTask} onDelete={handleDeleteTaskClick}
                    />
                  ))
              }
            </div>

            {/* Desktop: kanban */}
            <div className="hidden md:grid grid-cols-3 gap-4">
              {tasks.length === 0
                ? <p className="col-span-3 text-sm text-[#94A3B8] text-center py-8">No tasks yet. Add your first task to get started.</p>
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
                          <TaskCard key={task.id} task={task} isLead={isLead} currentUserId={user!.id}
                            evidenceCount={evidenceByTask[task.id]?.length ?? 0}
                            onClick={setSelectedTask} onEdit={setEditingTask} onDelete={handleDeleteTaskClick}
                          />
                        ))}
                      </div>
                    );
                  })
              }
            </div>
            </>}
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
                  {/* clock body */}
                  <circle cx="60" cy="42" r="28" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2"/>
                  <circle cx="60" cy="42" r="22" fill="white"/>
                  {/* clock hands */}
                  <line x1="60" y1="42" x2="60" y2="26" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="60" y1="42" x2="70" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="60" cy="42" r="2.5" fill="#94A3B8"/>
                  {/* tick marks */}
                  <line x1="60" y1="22" x2="60" y2="25" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="60" y1="59" x2="60" y2="62" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="40" y1="42" x2="43" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="77" y1="42" x2="80" y2="42" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[14px] font-semibold text-[#475569] mb-1">No activity yet</p>
                <p className="text-sm text-[#94A3B8]">Actions will appear here as your team works.</p>
              </div>
            ) : activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)
            }
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            {members.length < 6 && <InviteBanner token={group.invite_token} />}

            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} tasks={tasks}
                isThisMemberLead={m.profile_id === group.lead_id}
                canRemove={isLead && m.profile_id !== user?.id}
                onRemove={() => setMemberToRemove(m)}
              />
            ))}

            {/* Group management */}
            <div className="mt-4 flex flex-col gap-2">
              {isLead && (
                <button onClick={() => setShowTransferLead(true)}
                  className="w-full h-10 border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                  Transfer Lead
                </button>
              )}
              {isLead ? (
                <button onClick={() => setShowDeleteGroup(true)}
                  className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                  <IconTrash size={15} /> Delete Group
                </button>
              ) : (
                <button onClick={() => setShowLeaveConfirm(true)}
                  className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                  Leave Group
                </button>
              )}
            </div>
          </div>
        )}
        {/* ── EVALUATION TAB ── */}
        {tab === 'evaluation' && (
          <div>
            {/* Not open */}
            {!evalSession && (
              <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-3">
                <p className="text-[15px] font-semibold text-[#0F172A]">Peer Review</p>
                <p className="text-sm text-[#475569] max-w-xs">
                  When all work is done, the lead opens peer review so teammates can rate each other&apos;s contributions.
                </p>
                {isLead ? (
                  <button onClick={handleOpenEvaluation}
                    className="mt-2 h-10 px-5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-md transition-colors">
                    Open Peer Review
                  </button>
                ) : (
                  <p className="text-sm text-[#94A3B8]">
                    Waiting for the lead to open peer review.
                  </p>
                )}
              </div>
            )}

            {/* Open + not yet submitted */}
            {evalSession && !hasSubmitted && (
              <EvaluationForm
                groupId={group.id}
                currentUserId={user!.id}
                members={members}
                onSubmit={handleSubmitEvaluation}
              />
            )}

            {/* Open + not yet submitted */}
            {evalSession && !hasSubmitted && isLead && (
              <div className="flex justify-center mt-2 pb-4">
                <button onClick={() => setShowResetEval(true)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
                  Reset evaluation
                </button>
              </div>
            )}

            {/* Open + submitted */}
            {evalSession && hasSubmitted && (
              <>
                <EvaluationResults
                  summaries={evalSummaries}
                  members={members}
                  currentUserId={user!.id}
                  memberCount={members.length}
                />
                {isLead && (
                  <div className="flex justify-center mt-2 pb-4">
                    <button onClick={() => setShowResetEval(true)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
                      Reset evaluation
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#E2E8F0] flex"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard',  label: 'Groups',   icon: <IconHome size={22} />,     action: () => router.push('/dashboard') },
          { id: 'tasks',      label: 'Tasks',    icon: <IconBoard size={22} />,    action: () => setTab('tasks') },
          { id: 'activity',   label: 'Timeline', icon: <IconActivity size={22} />, action: () => setTab('activity') },
          { id: 'members',    label: 'Members',  icon: <IconUsers size={22} />,    action: () => setTab('members') },
          { id: 'evaluation', label: 'Review',   icon: <IconCheck size={22} />,    action: () => setTab('evaluation') },
        ].map((item) => (
          <button key={item.id} onClick={item.action}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              item.id === tab ? 'text-brand' : 'text-[#94A3B8]'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mobile FAB */}
      {tab === 'tasks' && (
        <button onClick={() => setShowNewTask(true)}
          className="md:hidden fixed right-5 z-40 bg-brand text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 16px)', width: 52, height: 52, boxShadow: '0 4px 16px rgba(26,86,232,.25)' }}
        >
          <IconPlus size={22} />
        </button>
      )}

      {/* ── MODALS ── */}
      {selectedTask && (
        <TaskModal task={selectedTask} members={members} userId={user!.id} isLead={isLead}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { refreshTasks(); refreshActivity(); refreshEvidence(); setSelectedTask(null); }}
        />
      )}
      {showNewTask && groupId && (
        <TaskForm groupId={groupId} members={members} userId={user!.id}
          onCreated={() => { refreshTasks(); refreshActivity(); }}
          onClose={() => setShowNewTask(false)}
        />
      )}
      {editingTask && (
        <EditTaskModal task={editingTask} members={members} userId={user!.id}
          onClose={() => setEditingTask(null)}
          onUpdated={() => { refreshTasks(); refreshActivity(); setEditingTask(null); }}
        />
      )}
      {taskToDelete && (
        <ConfirmModal
          title="Delete task"
          message={`Delete "${taskToDelete.title}"? This cannot be undone.`}
          confirmLabel="Delete" destructive
          onConfirm={executeDeleteTask}
          onCancel={() => setTaskToDelete(null)}
        />
      )}

      {showEditGroup && (
        <EditGroupModal group={group} userId={user!.id}
          onClose={() => setShowEditGroup(false)}
          onUpdated={() => { refreshGroup(); refreshActivity(); setShowEditGroup(false); }}
        />
      )}
      {showDeleteGroup && (
        <ConfirmModal
          title="Delete group"
          message="Are you sure? This will permanently delete all tasks and activity. This cannot be undone."
          confirmLabel="Delete group" destructive
          onConfirm={executeDeleteGroup}
          onCancel={() => setShowDeleteGroup(false)}
        />
      )}
      {showTransferLead && (
        <TransferLeadModal group={group} members={members} userId={user!.id}
          onClose={() => setShowTransferLead(false)}
          onUpdated={() => { refreshGroup(); refreshActivity(); setShowTransferLead(false); }}
        />
      )}
      {showLeaveConfirm && (
        <ConfirmModal
          title="Leave group" message="Are you sure you want to leave this group?"
          confirmLabel="Leave" destructive
          onConfirm={executeLeaveGroup}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {memberToRemove && (
        <ConfirmModal
          title="Remove member"
          message={`Remove ${memberToRemove.profile?.name ?? 'this member'} from the group? Their activity history will remain visible.`}
          confirmLabel="Remove" destructive
          onConfirm={executeRemoveMember}
          onCancel={() => setMemberToRemove(null)}
        />
      )}
      {showResetEval && (
        <ConfirmModal
          title="Reset evaluation"
          message="This will delete all submitted scores and close the evaluation session. This cannot be undone."
          confirmLabel="Reset" destructive
          onConfirm={executeResetEvaluation}
          onCancel={() => setShowResetEval(false)}
        />
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireStudent(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
