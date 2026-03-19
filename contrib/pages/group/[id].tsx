import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
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
import { IconPlus, IconExport, IconPencil, IconTrash, IconHome, IconBoard, IconActivity, IconUsers, IconList, IconCheck } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { useActivity } from '@/hooks/use-activity';
import { useGroupEvidence } from '@/hooks/use-group-evidence';
import { useEvaluationSession } from '@/hooks/use-evaluation-session';
import { useEvaluation } from '@/hooks/use-evaluation';
import { useEvaluationSummaries } from '@/hooks/use-evaluation-summaries';
import { generateReport } from '@/lib/pdf';
import type { Task, TaskStatus, GroupMember, Evaluation } from '@/types';

type Tab = 'tasks' | 'activity' | 'members' | 'evaluation';
type EvaluationInsert = Omit<Evaluation, 'id' | 'submitted_at'>;
type StatusFilter = 'all' | TaskStatus;

const STATUS_COLS: { status: TaskStatus; label: string; countClass: string; headerClass: string }[] = [
  { status: 'todo',       label: 'To Do',      countClass: 'bg-[#E8E5E3] text-[#57534E]',  headerClass: 'bg-[#F5F5F4] text-[#57534E]' },
  { status: 'inprogress', label: 'In Progress', countClass: 'bg-[#FDE68A] text-[#92400E]', headerClass: 'bg-[#FEF3C7] text-[#B45309]' },
  { status: 'done',       label: 'Done',        countClass: 'bg-[#BBF7D0] text-[#15803D]', headerClass: 'bg-[#DCFCE7] text-[#15803D]' },
];

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;
  const groupId = typeof id === 'string' ? id : undefined;

  const { user, profile, loading: userLoading } = useUser();
  const { group, members, isLead, loading: groupLoading, refresh: refreshGroup } = useGroup(groupId, user?.id);
  const { tasks, refresh: refreshTasks } = useTasks(groupId);
  const { activity, refresh: refreshActivity } = useActivity(groupId);
  const taskIds = tasks.map((t) => t.id);
  const { evidenceByTask, refresh: refreshEvidence } = useGroupEvidence(taskIds);
  const { session: evalSession, loading: evalSessionLoading, openEvaluation, refresh: refreshEvalSession } = useEvaluationSession(groupId);
  const { hasSubmitted, submit: submitEvaluation, refresh: refreshEvalSubmit } = useEvaluation(groupId, user?.id);
  const { summaries: evalSummaries, refresh: refreshSummaries } = useEvaluationSummaries(groupId, !!evalSession);

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

  useEffect(() => {
    if (!userLoading && !user) router.replace('/signup');
  }, [user, userLoading, router]);

  function handleDeleteTaskClick(task: Task) {
    setTaskToDelete(task);
  }

  async function executeDeleteTask() {
    if (!taskToDelete || !user) return;
    await supabase.from('activity_log').insert({
      group_id: taskToDelete.group_id,
      actor_id: user.id,
      action: 'task_deleted',
      task_id: taskToDelete.id,
      meta: { task_title: taskToDelete.title },
    });
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskToDelete.id);
    setTaskToDelete(null);
    refreshTasks();
    refreshActivity();
  }

  async function executeDeleteGroup() {
    if (!group) return;
    await supabase.from('groups').delete().eq('id', group.id);
    router.push('/dashboard');
  }

  async function executeLeaveGroup() {
    if (!user || !group) return;
    const myMembership = members.find((m) => m.profile_id === user.id);
    if (!myMembership) return;
    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: user.id,
      action: 'member_left',
      task_id: null,
      meta: null,
    });
    await supabase.from('group_members').delete().eq('id', myMembership.id);
    router.push('/dashboard');
  }

  async function executeRemoveMember() {
    if (!memberToRemove || !user || !group) return;
    await supabase.from('activity_log').insert({
      group_id: group.id,
      actor_id: user.id,
      action: 'member_removed',
      task_id: null,
      meta: { removed_name: memberToRemove.profile?.name ?? '' },
    });
    await supabase.from('group_members').delete().eq('id', memberToRemove.id);
    setMemberToRemove(null);
    refreshGroup();
    refreshActivity();
  }

  function handleExport() {
    if (!group) return;
    generateReport(group, members, tasks, activity, evidenceByTask, evalSummaries);
  }

  async function handleOpenEvaluation() {
    if (!groupId || !user) return;
    await openEvaluation(groupId, user.id);
    await supabase.from('activity_log').insert({
      group_id: groupId,
      actor_id: user.id,
      action: 'evaluation_opened',
      task_id: null,
      meta: null,
    });
    refreshActivity();
  }

  async function handleSubmitEvaluation(entries: EvaluationInsert[]) {
    if (!groupId || !user) return;
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
  }

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
  const isMember = members.some((m) => m.profile_id === user?.id);
  const nonLeadMembers = members.filter((m) => m.profile_id !== group?.lead_id);

  if (userLoading || groupLoading) {
    return <div className="flex items-center justify-center min-h-dvh"><div className="spinner" /></div>;
  }

  if (!group || !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 text-[#57534E]">
        <p>Group not found or you are not a member.</p>
        <button onClick={() => router.push('/dashboard')} className="text-[#FF5841] text-sm">← Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} group={group} onTabChange={(t) => setTab(t as Tab)} activeTab={tab} />

      <div className="pt-14 md:pt-0 md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => router.push('/dashboard')} className="text-[#A8A29E] hover:text-[#57534E] transition-colors">
              My Groups
            </button>
            <span className="text-[#D6D3D1]">›</span>
            <span className="font-semibold text-[#1C1917]">{group.name}</span>
            <span className="text-[#A8A29E]">{group.subject}</span>
            {isLead && (
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={() => setShowEditGroup(true)} className="p-1.5 text-[#A8A29E] hover:text-[#57534E] hover:bg-[#F5F5F4] rounded-md transition-colors" title="Edit group">
                  <IconPencil size={13} />
                </button>
                <button onClick={() => setShowDeleteGroup(true)} className="p-1.5 text-[#A8A29E] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete group">
                  <IconTrash size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isLead && (
              <button onClick={handleExport} className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
                <IconExport size={14} /> Export PDF
              </button>
            )}
            <button onClick={() => setShowNewTask(true)} className="h-8 px-3 bg-[#FF5841] hover:bg-[#E04030] text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
              <IconPlus size={14} /> Add task
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E7E5E4] bg-white sticky top-14 md:top-0 z-30 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(['tasks', 'activity', 'members', 'evaluation'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors capitalize ${
                tab === t ? 'text-[#FF5841] border-[#FF5841]' : 'text-[#A8A29E] border-transparent'
              }`}
            >
              {t === 'evaluation' ? 'Evaluation' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
            {members.length < 6 && <InviteBanner token={group.invite_token} />}

            {/* All-tasks-done evaluation nudge (lead only, evaluation not yet open) */}
            {isLead && !evalSessionLoading && !evalSession && tasks.length > 0 && tasks.every((t) => t.status === 'done') && (
              <div className="bg-[#FFF0EE] border border-[#FFCFC9] rounded-[10px] px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-[#1C1917]">All tasks complete — ready for peer evaluation?</p>
                <button onClick={handleOpenEvaluation}
                  className="flex-shrink-0 h-8 px-3 bg-[#FF5841] hover:bg-[#E04030] text-white text-[13px] font-medium rounded-md transition-colors">
                  Open Evaluation
                </button>
              </div>
            )}

            {/* Stats row */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'Total tasks', value: tasks.length,                                        color: '' },
                { label: 'Done',        value: tasks.filter(t => t.status === 'done').length,       color: '#16A34A' },
                { label: 'In progress', value: tasks.filter(t => t.status === 'inprogress').length, color: '#D97706' },
                { label: 'To do',       value: tasks.filter(t => t.status === 'todo').length,       color: '#A8A29E' },
              ].map((s) => (
                <div key={s.label} className="flex-shrink-0 bg-white border border-[#E7E5E4] rounded-[10px] px-3.5 py-2.5 min-w-[80px]"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <p className="text-lg font-bold" style={{ color: s.color || '#1C1917' }}>{s.value}</p>
                  <p className="text-[12px] text-[#A8A29E] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mobile: status filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto md:hidden" style={{ scrollbarWidth: 'none' }}>
              {(['all', 'todo', 'inprogress', 'done'] as StatusFilter[]).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    statusFilter === s ? 'bg-[#FFF0EE] text-[#FF5841] border-[#FFCFC9]' : 'bg-white text-[#57534E] border-[#E7E5E4]'
                  }`}
                >
                  {{ all: `All (${tasks.length})`, todo: `To Do (${tasks.filter(t=>t.status==='todo').length})`, inprogress: `In Progress (${tasks.filter(t=>t.status==='inprogress').length})`, done: `Done (${tasks.filter(t=>t.status==='done').length})` }[s]}
                </button>
              ))}
            </div>

            {/* Mobile: flat list */}
            <div className="md:hidden">
              {tasks.length === 0
                ? <p className="text-sm text-[#A8A29E] text-center py-8">No tasks yet. Add your first task to get started.</p>
                : filteredTasks.length === 0
                ? <p className="text-sm text-[#A8A29E] text-center py-8">No tasks here.</p>
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
                ? <p className="col-span-3 text-sm text-[#A8A29E] text-center py-8">No tasks yet. Add your first task to get started.</p>
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
                          <div className="flex items-center justify-center py-8 border-2 border-dashed border-[#E7E5E4] rounded-[10px]">
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
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-3">Recent activity</p>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <svg viewBox="0 0 120 90" fill="none" className="w-28 mx-auto mb-4 opacity-80">
                  <ellipse cx="60" cy="82" rx="44" ry="6" fill="#F5F5F4"/>
                  {/* clock body */}
                  <circle cx="60" cy="42" r="28" fill="#F5F5F4" stroke="#E7E5E4" strokeWidth="2"/>
                  <circle cx="60" cy="42" r="22" fill="white"/>
                  {/* clock hands */}
                  <line x1="60" y1="42" x2="60" y2="26" stroke="#D6D3D1" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="60" y1="42" x2="70" y2="48" stroke="#D6D3D1" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="60" cy="42" r="2.5" fill="#A8A29E"/>
                  {/* tick marks */}
                  <line x1="60" y1="22" x2="60" y2="25" stroke="#E7E5E4" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="60" y1="59" x2="60" y2="62" stroke="#E7E5E4" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="40" y1="42" x2="43" y2="42" stroke="#E7E5E4" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="77" y1="42" x2="80" y2="42" stroke="#E7E5E4" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[14px] font-semibold text-[#57534E] mb-1">No activity yet</p>
                <p className="text-sm text-[#A8A29E]">Actions will appear here as your team works.</p>
              </div>
            ) : activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)
            }
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-3">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} tasks={tasks}
                isThisMemberLead={m.profile_id === group.lead_id}
                canRemove={isLead && m.profile_id !== user?.id}
                onRemove={() => setMemberToRemove(m)}
              />
            ))}

            {/* Group actions */}
            <div className="mt-6 flex flex-col gap-2">
              {isLead && (
                <>
                  <button onClick={() => setShowTransferLead(true)}
                    className="w-full h-10 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                    Transfer Lead
                  </button>
                  <button onClick={handleExport}
                    className="w-full h-10 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                    <IconExport size={15} /> Export Report (PDF)
                  </button>
                  <button onClick={() => setShowEditGroup(true)}
                    className="w-full h-10 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors md:hidden">
                    <IconPencil size={15} /> Edit Group
                  </button>
                  <button onClick={() => setShowDeleteGroup(true)}
                    className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors md:hidden">
                    <IconTrash size={15} /> Delete Group
                  </button>
                </>
              )}
              {!isLead && (
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
                <p className="text-[15px] font-semibold text-[#1C1917]">Peer Evaluation</p>
                <p className="text-sm text-[#57534E] max-w-xs">
                  When all work is done, the lead opens evaluation so teammates can rate each other&apos;s contributions.
                </p>
                {isLead ? (
                  <button onClick={handleOpenEvaluation}
                    className="mt-2 h-10 px-5 bg-[#FF5841] hover:bg-[#E04030] text-white text-sm font-semibold rounded-md transition-colors">
                    Open Peer Evaluation
                  </button>
                ) : (
                  <p className="text-sm text-[#A8A29E]">
                    Waiting for the lead to open evaluation.
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

            {/* Open + submitted */}
            {evalSession && hasSubmitted && (
              <EvaluationResults
                summaries={evalSummaries}
                members={members}
                currentUserId={user!.id}
                memberCount={members.length}
              />
            )}
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#E7E5E4] flex"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard', label: 'Groups',   icon: <IconHome size={22} />,     action: () => router.push('/dashboard') },
          { id: 'tasks',     label: 'Tasks',    icon: <IconBoard size={22} />,    action: () => setTab('tasks') },
          { id: 'activity',  label: 'Activity', icon: <IconActivity size={22} />, action: () => setTab('activity') },
          { id: 'members',   label: 'Members',  icon: <IconUsers size={22} />,    action: () => setTab('members') },
        ].map((item) => (
          <button key={item.id} onClick={item.action}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              item.id === tab ? 'text-[#FF5841]' : 'text-[#A8A29E]'
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
          className="md:hidden fixed right-5 z-40 bg-[#FF5841] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 16px)', width: 52, height: 52, boxShadow: '0 4px 16px rgba(255,88,65,.4)' }}
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
    </div>
  );
}
