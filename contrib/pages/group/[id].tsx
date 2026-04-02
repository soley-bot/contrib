import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { supabase } from '@/lib/supabase';
import { requireStudent } from '@/lib/supabase-server';
import StudentNav from '@/components/student-nav';
import TaskModal from '@/components/task-modal';
import TaskForm from '@/components/task-form';
import EditTaskModal from '@/components/edit-task-modal';
import EditGroupModal from '@/components/edit-group-modal';
import TransferLeadModal from '@/components/transfer-lead-modal';
import ConfirmModal from '@/components/confirm-modal';
import BlockerModal from '@/components/blocker-modal';
import GroupTasksTab from '@/components/group-tasks-tab';
import GroupTimelineTab from '@/components/group-timeline-tab';
import GroupMembersTab from '@/components/group-members-tab';
import GroupEvaluationTab from '@/components/group-evaluation-tab';
import { IconPlus, IconPencil, IconTrash, IconHome, IconBoard, IconActivity, IconUsers, IconCheck, IconAlertTriangle } from '@/components/icons';
import GroupActionsMenu from '@/components/group-actions-menu';
import { useUser } from '@/hooks/use-user';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { useActivity } from '@/hooks/use-activity';
import { useGroupEvidence } from '@/hooks/use-group-evidence';
import { useEvaluationSession } from '@/hooks/use-evaluation-session';
import { useEvaluation } from '@/hooks/use-evaluation';
import { useEvaluationSummaries } from '@/hooks/use-evaluation-summaries';
import { useShareLink } from '@/hooks/use-share-link';
import { generateReport, DEFAULT_PDF_THEME } from '@/lib/pdf';
import { useToast } from '@/components/toast-provider';
import type { Task, GroupMember, EvaluationInsert } from '@/types';

type Tab = 'tasks' | 'activity' | 'members' | 'evaluation';

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;
  const groupId = typeof id === 'string' ? id : undefined;

  const { user, profile, loading: userLoading } = useUser();
  const { group, members, isLead, loading: groupLoading, refresh: refreshGroup } = useGroup(groupId, user?.id);
  const { tasks, loading: tasksLoading, refresh: refreshTasks } = useTasks(groupId);
  const { activity, loadMore, hasMore, loadingMore, refresh: refreshActivity } = useActivity(groupId);
  const taskIds = tasks.map((t) => t.id);
  const { evidenceByTask, refresh: refreshEvidence } = useGroupEvidence(taskIds);
  const { session: evalSession, loading: evalSessionLoading, openEvaluation, resetEvaluation, refresh: refreshEvalSession } = useEvaluationSession(groupId);
  const { hasSubmitted, submit: submitEvaluation, refresh: refreshEvalSubmit } = useEvaluation(groupId, user?.id);
  const { summaries: evalSummaries, refresh: refreshSummaries } = useEvaluationSummaries(groupId, !!evalSession);
  const { shareUrl, shareLoading, handleShareLink, handleRevokeShare } = useShareLink(groupId, user?.id, isLead, refreshActivity);

  const [pdfTheme, setPdfTheme] = useState<[number, number, number]>(DEFAULT_PDF_THEME);
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('tasks');
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
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check for just-joined welcome banner
  useEffect(() => {
    if (!groupId) return;
    try {
      const key = `contrib_just_joined_${groupId}`;
      if (localStorage.getItem(key)) {
        setShowWelcome(true);
        localStorage.removeItem(key);
      }
    } catch {}
  }, [groupId]);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/signup');
  }, [user, userLoading, router]);

  function handleDeleteTaskClick(task: Task) {
    setTaskToDelete(task);
  }

  const actionInFlight = useRef(false);

  async function executeDeleteTask() {
    if (!taskToDelete || !user || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskToDelete.id);
      if (error) throw error;
      await supabase.from('activity_log').insert({
        group_id: taskToDelete.group_id,
        actor_id: user.id,
        action: 'task_deleted',
        task_id: taskToDelete.id,
        meta: { task_title: taskToDelete.title },
      });
      setTaskToDelete(null);
      refreshTasks();
      refreshActivity();
    } catch { showToast('Failed to delete task. Please try again.'); } finally { actionInFlight.current = false; }
  }

  async function executeDeleteGroup() {
    if (!group || !isLead || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      const { error } = await supabase.from('groups').update({ archived_at: new Date().toISOString() }).eq('id', group.id);
      if (error) throw error;
      router.push('/dashboard');
    } catch { showToast('Failed to archive group. Please try again.'); } finally { actionInFlight.current = false; }
  }

  async function executeLeaveGroup() {
    if (!user || !group || actionInFlight.current) return;
    actionInFlight.current = true;
    const myMembership = members.find((m) => m.profile_id === user.id);
    if (!myMembership) { actionInFlight.current = false; return; }
    try {
      if (isLead) {
        const otherMembers = members.filter((m) => m.profile_id !== user.id);
        if (otherMembers.length > 0) {
          showToast('Transfer leadership before leaving. Go to Members and assign a new lead.', 'error');
          setShowLeaveConfirm(false);
          return;
        }
        // Only member — archive the group
        await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('group_id', group.id);
        await supabase.from('group_members').delete().eq('group_id', group.id);
        const { error } = await supabase.from('groups').update({ archived_at: new Date().toISOString() }).eq('id', group.id);
        if (error) throw error;
        router.push('/dashboard');
        return;
      }
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
    } catch { showToast('Failed to leave group. Please try again.'); } finally { actionInFlight.current = false; }
  }

  async function executeRemoveMember() {
    if (!memberToRemove || !user || !group || !isLead || actionInFlight.current) return;
    actionInFlight.current = true;
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
    } catch { showToast('Failed to remove member. Please try again.'); } finally { actionInFlight.current = false; }
  }

  function handleExport() {
    if (!group) return;
    generateReport(group, members, tasks, activity, evidenceByTask, [], pdfTheme, 'student');
    if (user) {
      supabase.from('activity_log').insert({
        group_id: group.id, actor_id: user.id, action: 'report_exported',
        task_id: null, meta: { mode: 'student' },
      });
    }
  }

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
      members.filter((m) => m.profile_id !== user.id).forEach((m) => {
        supabase.from('notifications').insert({
          recipient_id: m.profile_id,
          group_id: groupId,
          type: 'evaluation_opened',
          title: 'Peer review is now open',
          meta: { groupName: group?.name },
        }).then(null, () => {});
      });
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, message: `Peer review is now open in ${group?.name ?? 'your group'}. Go to Contrib to submit your review.`, type: 'contributions' }),
      }).catch(() => {});
      refreshActivity();
    } catch { showToast('Failed to open peer review. Please try again.'); }
  }

  async function executeResetEvaluation() {
    if (!groupId || !isLead) return;
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

  const isMember = members.some((m) => m.profile_id === user?.id);

  // Tab badge computations
  const myTodoCount = tasks.filter((t) => t.status === 'todo' && t.assignee_id === user?.id).length;
  const hasNewActivity = (() => {
    if (!groupId || activity.length === 0) return false;
    try {
      const lastVisit = localStorage.getItem(`contrib_timeline_${groupId}`);
      if (!lastVisit) return true;
      return new Date(activity[0]?.created_at) > new Date(lastVisit);
    } catch { return false; }
  })();
  const needsEvalAction = !!evalSession && !hasSubmitted;
  const tabBadges = { tasks: myTodoCount, activity: hasNewActivity, evaluation: needsEvalAction };

  // Track timeline visits
  useEffect(() => {
    if (tab === 'activity' && groupId) {
      try { localStorage.setItem(`contrib_timeline_${groupId}`, new Date().toISOString()); } catch {}
    }
  }, [tab, groupId]);

  // ── Swipe navigation between tabs ──
  const TABS: Tab[] = ['tasks', 'activity', 'members', 'evaluation'];
  const touchRef = useRef({ x: 0, y: 0, active: false });
  const anyModalOpen = !!(selectedTask || showNewTask || editingTask || taskToDelete || showEditGroup || showDeleteGroup || showTransferLead || showLeaveConfirm || memberToRemove || showResetEval || showBlockerModal);

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
    if (anyModalOpen) return;
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [anyModalOpen]);

  if (userLoading || groupLoading) {
    return (
      <div className="min-h-dvh bg-bg">
        {/* Skeleton: mobile header */}
        <div className="md:hidden h-14 bg-white border-b border-border" />
        {/* Skeleton: desktop sidebar placeholder */}
        <div className="hidden md:block fixed top-0 left-0 h-full w-[220px] bg-white border-r border-border" />
        <div className="pt-16 md:pt-0 md:pl-[220px]">
          {/* Skeleton: topbar */}
          <div className="hidden md:flex items-center h-14 px-6 bg-white border-b border-border gap-3">
            <div className="h-4 w-24 bg-border rounded animate-pulse" />
            <div className="h-4 w-4 bg-bg-hover rounded animate-pulse" />
            <div className="h-4 w-32 bg-border rounded animate-pulse" />
          </div>
          {/* Skeleton: tab bar */}
          <div className="flex gap-4 px-5 py-3 border-b border-border bg-white md:hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-16 bg-border rounded animate-pulse" />
            ))}
          </div>
          {/* Skeleton: content cards */}
          <div className="px-4 py-5 max-w-2xl mx-auto flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-4 flex items-start gap-3 animate-pulse">
                <div className="w-5 h-5 rounded bg-border flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-border rounded mb-2" />
                  <div className="h-3 w-32 bg-bg-hover rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !group || !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 text-text-secondary">
        <p>Group not found or you are not a member.</p>
        <button onClick={() => router.push('/dashboard')} className="text-brand text-sm">← Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg">
      <StudentNav profile={profile} group={group} onTabChange={(t) => setTab(t as Tab)} activeTab={tab} tabBadges={tabBadges} />

      <div className="pt-16 md:pt-0 md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-border">
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => router.push('/dashboard')} className="text-text-tertiary hover:text-text-secondary transition-colors">
              My Groups
            </button>
            <span className="text-[#CBD5E1]">›</span>
            <span className="font-semibold text-text">{group.name}</span>
            <span className="text-text-tertiary">{group.subject}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBlockerModal(true)} className="h-9 px-3 border border-border bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[13px] font-medium text-text-secondary hover:text-[#DC2626] rounded-md flex items-center gap-1.5 transition-colors">
              <IconAlertTriangle size={13} /> Heads Up
            </button>
            <button onClick={() => setShowNewTask(true)} className="h-9 px-3 bg-brand hover:bg-brand-hover text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
              <IconPlus size={14} /> Add task
            </button>
            <GroupActionsMenu
              isLead={isLead}
              inviteToken={group.invite_token}
              onEditGroup={() => setShowEditGroup(true)}
              onCopyInvite={() => {
                const url = `${window.location.origin}/join/${group.invite_token}`;
                navigator.clipboard.writeText(url);
                showToast('Invite link copied!', 'success');
              }}
              onExport={handleExport}
              onShareReport={handleShareLink}
              onTransferLead={() => setShowTransferLead(true)}
              onDeleteGroup={() => setShowDeleteGroup(true)}
              onLeaveGroup={() => setShowLeaveConfirm(true)}
            />
          </div>
        </div>

        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between h-12 px-4 bg-white border-b border-border">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-sm text-text truncate">{group.name}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowBlockerModal(true)} className="h-7 px-2.5 border border-border bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[11px] font-medium text-text-secondary hover:text-[#DC2626] rounded-md flex items-center gap-1 transition-colors">
              <IconAlertTriangle size={12} /> Heads Up
            </button>
            <GroupActionsMenu
              isLead={isLead}
              inviteToken={group.invite_token}
              onEditGroup={() => setShowEditGroup(true)}
              onCopyInvite={() => {
                const url = `${window.location.origin}/join/${group.invite_token}`;
                navigator.clipboard.writeText(url);
                showToast('Invite link copied!', 'success');
              }}
              onExport={handleExport}
              onShareReport={handleShareLink}
              onTransferLead={() => setShowTransferLead(true)}
              onDeleteGroup={() => setShowDeleteGroup(true)}
              onLeaveGroup={() => setShowLeaveConfirm(true)}
            />
          </div>
        </div>

        {/* Welcome banner for new members */}
        {showWelcome && (
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="bg-brand-light border border-[#93B4FF] rounded-xl px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text mb-1">Welcome to {group.name}!</p>
                <p className="text-[13px] text-text-secondary">
                  Use <strong>Tasks</strong> to log your work, <strong>Timeline</strong> to see activity, and <strong>Peer Review</strong> when your lead opens it.
                </p>
              </div>
              <button onClick={() => setShowWelcome(false)} className="flex-shrink-0 p-1 text-text-tertiary hover:text-text transition-colors" aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT ── */}
        {tab === 'tasks' && (
          <GroupTasksTab
            tasks={tasks}
            members={members}
            isLead={isLead}
            userId={user.id}
            groupId={groupId!}
            tasksLoading={tasksLoading}
            evalSession={!!evalSession}
            evalSessionLoading={evalSessionLoading}
            hasSubmitted={hasSubmitted}
            evalSummaries={evalSummaries}
            evidenceByTask={evidenceByTask}
            pdfTheme={pdfTheme}
            setPdfTheme={setPdfTheme}
            shareUrl={shareUrl}
            shareLoading={shareLoading}
            onShareLink={handleShareLink}
            onRevokeShare={handleRevokeShare}
            onCopyShareUrl={() => { navigator.clipboard.writeText(shareUrl!); showToast('Link copied!', 'success'); }}
            onExport={handleExport}
            onOpenEvaluation={handleOpenEvaluation}
            onSetTab={setTab}
            onSelectTask={setSelectedTask}
            onEditTask={setEditingTask}
            onDeleteTask={handleDeleteTaskClick}
            onNewTask={() => setShowNewTask(true)}
          />
        )}

        {tab === 'activity' && (
          <GroupTimelineTab
            activity={activity}
            onShowBlockerModal={() => setShowBlockerModal(true)}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        )}

        {tab === 'members' && (
          <GroupMembersTab
            group={group}
            members={members}
            tasks={tasks}
            isLead={isLead}
            userId={user.id}
            onRemoveMember={setMemberToRemove}
            onTransferLead={() => setShowTransferLead(true)}
            onDeleteGroup={() => setShowDeleteGroup(true)}
            onLeaveGroup={() => setShowLeaveConfirm(true)}
            onRefreshGroup={refreshGroup}
          />
        )}

        {tab === 'evaluation' && (
          <GroupEvaluationTab
            groupId={groupId!}
            userId={user.id}
            isLead={isLead}
            members={members}
            evalSession={evalSession}
            hasSubmitted={hasSubmitted}
            evalSummaries={evalSummaries}
            onOpenEvaluation={handleOpenEvaluation}
            onSubmitEvaluation={handleSubmitEvaluation}
            onShowResetEval={() => setShowResetEval(true)}
          />
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border flex"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard',  label: 'Groups',   icon: <IconHome size={22} />,     action: () => router.push('/dashboard') },
          { id: 'tasks',      label: 'Tasks',    icon: <IconBoard size={22} />,    action: () => setTab('tasks') },
          { id: 'activity',   label: 'Timeline', icon: <IconActivity size={22} />, action: () => setTab('activity') },
          { id: 'members',    label: 'Members',  icon: <IconUsers size={22} />,    action: () => setTab('members') },
          { id: 'evaluation', label: 'Review',   icon: <IconCheck size={22} />,    action: () => setTab('evaluation') },
        ].map((item) => {
          const badge = item.id === 'tasks' && tabBadges.tasks ? tabBadges.tasks
            : item.id === 'activity' && tabBadges.activity ? true
            : item.id === 'evaluation' && tabBadges.evaluation ? true
            : null;
          return (
            <button key={item.id} onClick={item.action}
              aria-current={item.id === tab ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${
                item.id === tab ? 'text-brand' : 'text-text-tertiary'
              }`}
            >
              <span className="relative">
                {item.icon}
                {badge && (
                  typeof badge === 'number'
                    ? <span className="absolute -top-1 -right-2.5 text-[9px] font-bold bg-brand text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{badge}</span>
                    : <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-brand" />
                )}
              </span>
              {item.label}
            </button>
          );
        })}
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
        <TaskForm groupId={groupId} groupName={group?.name} members={members} userId={user!.id}
          onCreated={() => { refreshTasks(); refreshActivity(); }}
          onClose={() => setShowNewTask(false)}
        />
      )}
      {editingTask && (
        <EditTaskModal task={editingTask} members={members} userId={user!.id} groupName={group?.name}
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
      {showBlockerModal && groupId && (
        <BlockerModal
          groupId={groupId}
          onClose={() => setShowBlockerModal(false)}
          onCreated={() => { refreshActivity(); showToast('Heads up sent to your group.', 'success'); }}
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
