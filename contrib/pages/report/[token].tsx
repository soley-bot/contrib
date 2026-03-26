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
      <div className="min-h-dvh bg-[#F8FAFF] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-3" />
          <p className="text-sm text-[#64748B]">Loading report...</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-dvh bg-[#F8FAFF] flex flex-col items-center justify-center gap-3 px-5 text-center">
        <span className="text-[#94A3B8]"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold text-[#0F172A]">Report not found</p>
        <p className="text-sm text-[#64748B]">This report link is invalid or has expired.</p>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-dvh bg-[#F8FAFF] flex flex-col items-center justify-center gap-3 px-5 text-center">
        <span className="text-[#94A3B8]"><IconAlertTriangle size={32} /></span>
        <p className="text-lg font-semibold text-[#0F172A]">Something went wrong</p>
        <p className="text-sm text-[#64748B]">Please try again later.</p>
      </div>
    );
  }

  const { group, members, tasks, activity, evidenceByTask } = data;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const leadMember = members.find((m) => m.profile_id === group.lead_id);
  const university = leadMember?.profile?.university ?? null;

  // Timeline stats
  const sortedActivity = [...activity].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const activeDays = new Set(sortedActivity.map((e) => new Date(e.created_at).toDateString())).size;
  const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium text-[#1A56E8] tracking-wider uppercase mb-1">Contribution Record</p>
              <h1 className="text-xl font-bold text-[#0F172A]">{group.name}</h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                {group.subject}
                {university && <> &middot; {university}</>}
                {group.due_date && <> &middot; Due {new Date(group.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-shrink-0 h-9 px-4 bg-[#1A56E8] hover:bg-[#1240C4] text-white text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60"
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
            <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold text-[#0F172A]">{s.value}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Member Contributions with visual bars */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-semibold text-[#0F172A]">Member Contributions</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {members.map((m) => {
              const mt = tasks.filter((t) => t.assignee_id === m.profile_id);
              const md = mt.filter((t) => t.status === 'done').length;
              const pct = mt.length > 0 ? Math.round((md / mt.length) * 100) : 0;
              const isLead = m.profile_id === group.lead_id;
              return (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-sm truncate ${isLead ? 'font-semibold' : ''} text-[#0F172A]`}>{m.profile?.name ?? 'Unknown'}</span>
                      {isLead && <span className="text-[10px] text-[#1A56E8] font-medium flex-shrink-0">Lead</span>}
                    </div>
                    <span className="text-[12px] text-[#64748B] flex-shrink-0 ml-2">{md}/{mt.length} tasks</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#1A56E8' : pct >= 50 ? '#16A34A' : pct > 0 ? '#D97706' : '#CBD5E1' }}
                      />
                    </div>
                    <span className={`text-[12px] font-semibold w-8 text-right ${pct === 100 ? 'text-[#1A56E8]' : 'text-[#0F172A]'}`}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-semibold text-[#0F172A]">Tasks</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {tasks.map((t) => {
              const hasEvidence = (evidenceByTask[t.id] ?? []).length > 0;
              const assignee = members.find((m) => m.profile_id === t.assignee_id);
              return (
                <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.status === 'done' ? 'bg-[#16A34A]' : t.status === 'inprogress' ? 'bg-[#D97706]' : 'bg-[#CBD5E1]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${t.status === 'done' ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>{t.title}</p>
                    <p className="text-[11px] text-[#94A3B8]">
                      {assignee?.profile?.name ?? 'Unassigned'}
                      {t.status === 'done' && hasEvidence && ' \u00b7 Evidence attached'}
                      {t.status === 'done' && !hasEvidence && ' \u00b7 No evidence'}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${
                    t.status === 'done' ? 'text-[#16A34A]' : t.status === 'inprogress' ? 'text-[#D97706]' : 'text-[#94A3B8]'
                  }`}>
                    {t.status === 'done' ? 'Done' : t.status === 'inprogress' ? 'In Progress' : 'To Do'}
                  </span>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[#94A3B8]">No tasks created yet.</div>
            )}
          </div>
        </div>

        {/* Timeline Summary */}
        {sortedActivity.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F172A]">Timeline</h2>
            </div>
            <div className="grid grid-cols-3 gap-px bg-[#F1F5F9]">
              {[
                { label: 'Total activities', value: String(sortedActivity.length) },
                { label: 'Active days', value: String(activeDays) },
                { label: 'Contributors', value: String(new Set(sortedActivity.map((e) => e.actor_id)).size) },
              ].map((s) => (
                <div key={s.label} className="bg-white px-4 py-3 text-center">
                  <p className="text-base font-bold text-[#0F172A]">{s.value}</p>
                  <p className="text-[11px] text-[#94A3B8]">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-[#F1F5F9] text-[12px] text-[#64748B]">
              {fmtShort(sortedActivity[0].created_at)} &ndash; {fmtShort(sortedActivity[sortedActivity.length - 1].created_at)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[11px] text-[#94A3B8]">
            Generated by <span className="font-medium">Contrib</span>
          </p>
        </div>
      </div>
    </div>
  );
}
