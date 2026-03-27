import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { IconAlertTriangle, IconExport } from '@/components/icons';
import { generateReport } from '@/lib/pdf';
import type { Group, GroupMember, Task, ActivityLog, Evidence } from '@/types';

interface ReportData {
  group: Group;
  members: GroupMember[];
  tasks: Task[];
  activity: ActivityLog[];
  evidenceByTask: Record<string, Evidence[]>;
}

export default function PublicReportPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState<ReportData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!router.isReady || !token) return;
    fetchReport();
  }, [router.isReady, token]);

  async function fetchReport() {
    try {
      const res = await fetch(`/api/report/lookup?token=${encodeURIComponent(token as string)}`);
      if (!res.ok) { setStatus('not-found'); return; }
      const json = await res.json();
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  function handleDownload() {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      generateReport(
        data.group,
        data.members,
        data.tasks,
        data.activity,
        data.evidenceByTask,
        [], // no evaluations in student mode
        undefined,
        'student'
      );
    } finally {
      setDownloading(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-3" />
          <p className="text-sm text-muted">Loading report...</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold text-text">Report not found</p>
        <p className="text-sm text-muted">This report link is invalid or has expired.</p>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-3 px-5 text-center">
        <span className="text-text-tertiary"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold text-text">Something went wrong</p>
        <p className="text-sm text-muted">Please try again later.</p>
      </div>
    );
  }

  const { group, members, tasks, activity, evidenceByTask } = data;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const leadMember = members.find((m) => m.profile_id === group.lead_id);
  const university = leadMember?.profile?.university ?? null;

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium text-brand tracking-wider uppercase mb-1">Contribution Record</p>
              <h1 className="text-xl font-bold text-text">{group.name}</h1>
              <p className="text-sm text-muted mt-0.5">
                {group.subject}
                {university && <> &middot; {university}</>}
                {group.due_date && <> &middot; Due {new Date(group.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-shrink-0 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <IconExport size={14} />
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Members', value: String(members.length) },
            { label: 'Tasks', value: String(totalTasks) },
            { label: 'Completion', value: `${completionPct}%` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold text-text">{s.value}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Member Contributions */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Member Contributions</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg text-muted text-[12px]">
                <th className="text-left px-4 py-2 font-medium">Member</th>
                <th className="text-right px-4 py-2 font-medium">Assigned</th>
                <th className="text-right px-4 py-2 font-medium">Done</th>
                <th className="text-right px-4 py-2 font-medium">Completion</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const mt = tasks.filter((t) => t.assignee_id === m.profile_id);
                const md = mt.filter((t) => t.status === 'done').length;
                const pct = mt.length > 0 ? Math.round((md / mt.length) * 100) : 0;
                const isLead = m.profile_id === group.lead_id;
                return (
                  <tr key={m.id} className="border-t border-bg-hover">
                    <td className="px-4 py-2.5">
                      <span className={isLead ? 'font-semibold' : ''}>{m.profile?.name ?? 'Unknown'}</span>
                      {isLead && <span className="ml-1.5 text-[10px] text-brand font-medium">Lead</span>}
                    </td>
                    <td className="text-right px-4 py-2.5 text-muted">{mt.length}</td>
                    <td className="text-right px-4 py-2.5 text-green font-medium">{md}</td>
                    <td className={`text-right px-4 py-2.5 font-medium ${pct === 100 ? 'text-brand' : 'text-text'}`}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Task List */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Tasks</h2>
          </div>
          <div className="divide-y divide-bg-hover">
            {tasks.map((t) => {
              const hasEvidence = (evidenceByTask[t.id] ?? []).length > 0;
              const assignee = members.find((m) => m.profile_id === t.assignee_id);
              return (
                <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.status === 'done' ? 'bg-green' : t.status === 'inprogress' ? 'bg-amber' : 'bg-[#CBD5E1]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${t.status === 'done' ? 'text-text' : 'text-muted'}`}>{t.title}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {assignee?.profile?.name ?? 'Unassigned'}
                      {t.status === 'done' && hasEvidence && ' \u00b7 Evidence attached'}
                      {t.status === 'done' && !hasEvidence && ' \u00b7 No evidence'}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${
                    t.status === 'done' ? 'text-green' : t.status === 'inprogress' ? 'text-amber' : 'text-text-tertiary'
                  }`}>
                    {t.status === 'done' ? 'Done' : t.status === 'inprogress' ? 'In Progress' : 'To Do'}
                  </span>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">No tasks created yet.</div>
            )}
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-white border border-border rounded-xl px-4 py-3">
          <h2 className="text-sm font-semibold text-text mb-1">Activity</h2>
          <p className="text-sm text-muted">
            {activity.length} activities logged
            {activity.length > 0 && (
              <> between {new Date(activity[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              {' '}&ndash;{' '}
              {new Date(activity[activity.length - 1].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>
            )}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[11px] text-text-tertiary">
            Generated by <span className="font-medium">Contrib</span> &middot; This report contains personal data of group members
          </p>
        </div>
      </div>
    </div>
  );
}
