import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '@/components/nav';
import TaskCard from '@/components/task-card';
import TaskModal from '@/components/task-modal';
import FeedItem from '@/components/feed-item';
import MemberRow from '@/components/member-row';
import InviteBanner from '@/components/invite-banner';
import { IconPlus, IconExport, IconHome, IconBoard, IconActivity, IconUsers, IconList, IconCheck } from '@/components/icons';
import { useUser } from '@/hooks/use-user';
import { useGroup } from '@/hooks/use-group';
import { useTasks } from '@/hooks/use-tasks';
import { supabase } from '@/lib/supabase';
import { generateReport } from '@/lib/pdf';
import type { Task, ActivityLog, TaskStatus } from '@/types';

type Tab = 'tasks' | 'activity' | 'members';
type StatusFilter = 'all' | TaskStatus;

const STATUS_COLS: { status: TaskStatus; label: string; countClass: string }[] = [
  { status: 'todo',       label: 'To Do',       countClass: 'bg-[#F5F5F4] text-[#57534E]' },
  { status: 'inprogress', label: 'In Progress',  countClass: 'bg-[#FEF3C7] text-[#D97706]' },
  { status: 'done',       label: 'Done',         countClass: 'bg-[#DCFCE7] text-[#16A34A]' },
];

export default function GroupPage() {
  const router = useRouter();
  const { id } = router.query;
  const groupId = typeof id === 'string' ? id : undefined;

  const { user, profile, loading: userLoading } = useUser();
  const { group, members, isLead, loading: groupLoading, refresh: refreshGroup } = useGroup(groupId, user?.id);
  const { tasks, refresh: refreshTasks } = useTasks(groupId);

  const [tab, setTab] = useState<Tab>('tasks');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [showNewTask, setShowNewTask] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskError, setTaskError] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/signup');
  }, [user, userLoading, router]);

  useEffect(() => {
    if (groupId) fetchActivity();
  }, [groupId]);

  async function fetchActivity() {
    const { data } = await supabase
      .from('activity_log')
      .select('*, actor:profiles!activity_log_actor_id_fkey(*)')
      .eq('group_id', groupId!)
      .order('created_at', { ascending: false });
    setActivity((data as ActivityLog[]) ?? []);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskError('');
    if (!taskTitle.trim() || !taskAssignee) { setTaskError('Title and assignee are required.'); return; }
    setCreatingTask(true);
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({ group_id: groupId, title: taskTitle.trim(), description: taskDesc.trim() || null, assignee_id: taskAssignee, due_date: taskDue || null, status: 'todo' })
      .select().single();

    if (error || !task) { setTaskError(error?.message ?? 'Failed to create task.'); setCreatingTask(false); return; }

    await supabase.from('activity_log').insert({ group_id: groupId, actor_id: user!.id, action: 'task_created', task_id: task.id, meta: { task_title: taskTitle.trim() } });

    refreshTasks(); fetchActivity();
    setShowNewTask(false); setTaskTitle(''); setTaskDesc(''); setTaskAssignee(''); setTaskDue(''); setCreatingTask(false);
  }

  async function handleExport() {
    if (!group) return;
    const { data: allActivity } = await supabase
      .from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(*)')
      .eq('group_id', groupId!);
    generateReport(group, members, tasks, (allActivity as ActivityLog[]) ?? []);
  }

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
  const isMember = members.some((m) => m.profile_id === user?.id);

  if (userLoading || groupLoading) return <div className="flex items-center justify-center min-h-dvh text-[#57534E]">Loading…</div>;

  if (!group || !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 text-[#57534E]">
        <p>Group not found or you are not a member.</p>
        <button onClick={() => router.push('/dashboard')} className="text-[#6366F1] text-sm">← Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <Nav profile={profile} group={group} onTabChange={(t) => setTab(t as Tab)} activeTab={tab} />

      {/* Main content — offset for desktop sidebar */}
      <div className="md:pl-[220px]">

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-[#E7E5E4]">
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => router.push('/dashboard')} className="text-[#A8A29E] hover:text-[#57534E] transition-colors">
              My Groups
            </button>
            <span className="text-[#D6D3D1]">›</span>
            <span className="font-semibold text-[#1C1917]">{group.name}</span>
            <span className="text-[#A8A29E]">{group.subject}</span>
          </div>
          <div className="flex gap-2">
            {isLead && (
              <button onClick={handleExport} className="h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
                <IconExport size={14} /> Export PDF
              </button>
            )}
            <button onClick={() => setShowNewTask(true)} className="h-8 px-3 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
              <IconPlus size={14} /> Add task
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E7E5E4] bg-white sticky top-14 md:top-0 z-30 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(['tasks', 'activity', 'members'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors capitalize ${
                tab === t ? 'text-[#6366F1] border-[#6366F1]' : 'text-[#A8A29E] border-transparent'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <InviteBanner token={group.invite_token} />

            {/* Stats row */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'Total tasks', value: tasks.length, color: '' },
                { label: 'Done',        value: tasks.filter(t => t.status === 'done').length,       color: '#16A34A' },
                { label: 'In progress', value: tasks.filter(t => t.status === 'inprogress').length, color: '#D97706' },
                { label: 'To do',       value: tasks.filter(t => t.status === 'todo').length,       color: '#A8A29E' },
              ].map((s) => (
                <div key={s.label} className="flex-shrink-0 bg-white border border-[#E7E5E4] rounded-[10px] px-3.5 py-2.5 min-w-[80px]"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <p className="text-lg font-bold" style={{ color: s.color || '#1C1917' }}>{s.value}</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mobile: status filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto md:hidden" style={{ scrollbarWidth: 'none' }}>
              {(['all', 'todo', 'inprogress', 'done'] as StatusFilter[]).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    statusFilter === s ? 'bg-[#EEF2FF] text-[#6366F1] border-[#C7D2FE]' : 'bg-white text-[#57534E] border-[#E7E5E4]'
                  }`}
                >
                  {{ all: `All (${tasks.length})`, todo: `To Do (${tasks.filter(t=>t.status==='todo').length})`, inprogress: `In Progress (${tasks.filter(t=>t.status==='inprogress').length})`, done: `Done (${tasks.filter(t=>t.status==='done').length})` }[s]}
                </button>
              ))}
            </div>

            {/* Mobile: flat list */}
            <div className="md:hidden">
              {filteredTasks.map((task) => <TaskCard key={task.id} task={task} onClick={setSelectedTask} />)}
              {filteredTasks.length === 0 && <p className="text-sm text-[#A8A29E] text-center py-8">No tasks here.</p>}
            </div>

            {/* Desktop: kanban */}
            <div className="hidden md:grid grid-cols-3 gap-4">
              {STATUS_COLS.map((col) => {
                const colTasks = tasks.filter(t => t.status === col.status);
                return (
                  <div key={col.status}>
                    <div className="flex items-center gap-1.5 mb-3">
                      {col.status === 'todo'       && <IconList size={14} />}
                      {col.status === 'inprogress' && <IconActivity size={14} />}
                      {col.status === 'done'       && <IconCheck size={14} />}
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#A8A29E]">{col.label}</span>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${col.countClass}`}>{colTasks.length}</span>
                    </div>
                    {colTasks.map((task) => <TaskCard key={task.id} task={task} onClick={setSelectedTask} />)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24 md:pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-3">Recent activity</p>
            {activity.length === 0
              ? <p className="text-sm text-[#A8A29E] text-center py-8">No activity yet.</p>
              : activity.map((entry) => <FeedItem key={entry.id} entry={entry} />)
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
              <MemberRow key={m.id} member={m} tasks={tasks} isLead={m.profile_id === group.lead_id} />
            ))}
            {isLead && (
              <button onClick={handleExport}
                className="w-full mt-6 h-11 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors">
                <IconExport size={16} /> Export Contribution Report (PDF)
              </button>
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
              (item.id === tab || (item.id === 'dashboard')) && item.id !== 'dashboard'
                ? 'text-[#6366F1]' : 'text-[#A8A29E]'
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
          className="md:hidden fixed right-5 z-40 bg-[#6366F1] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 16px)', width: 52, height: 52, boxShadow: '0 4px 16px rgba(99,102,241,.4)' }}
        >
          <IconPlus size={22} />
        </button>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} members={members} userId={user!.id} isLead={isLead}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { refreshTasks(); fetchActivity(); setSelectedTask(null); }}
        />
      )}

      {/* New task sheet */}
      {showNewTask && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewTask(false); }}>
          <div className="w-full md:max-w-[520px] bg-white rounded-t-[20px] md:rounded-[10px] max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
              <h2 className="text-base font-semibold text-[#1C1917]">Add Task</h2>
              <button onClick={() => setShowNewTask(false)} className="text-[#57534E] hover:text-[#1C1917] p-1">✕</button>
            </div>
            <form onSubmit={handleCreateTask} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Task title</label>
                <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Write executive summary"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Description <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3} placeholder="Add details…"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Assign to</label>
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none bg-white">
                  <option value="">Select member…</option>
                  {members.map((m) => (
                    <option key={m.profile_id} value={m.profile_id}>
                      {m.profile?.name ?? m.profile_id}{m.profile_id === user?.id ? ' (me)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Due date <span className="font-normal text-[#A8A29E]">(optional)</span></label>
                <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#6366F1] outline-none" />
              </div>
              {taskError && <p className="text-sm text-red-500">{taskError}</p>}
              <div className="pt-1 border-t border-[#E7E5E4]">
                <button type="submit" disabled={creatingTask}
                  className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
                  {creatingTask ? 'Adding…' : 'Add task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
