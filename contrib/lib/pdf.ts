import jsPDF from 'jspdf';
import type { Group, Task, ActivityLog, GroupMember, Evidence, EvaluationSummary } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function actionLabel(action: string, meta: Record<string, unknown> | null): string {
  switch (action) {
    case 'task_created':           return `Created task: ${meta?.task_title ?? ''}`;
    case 'task_assigned':          return `Assigned task: ${meta?.task_title ?? ''}`;
    case 'task_updated':           return `Updated task: ${meta?.task_title ?? ''}`;
    case 'task_done':              return `Completed task: ${meta?.task_title ?? ''}`;
    case 'file_uploaded':          return `Uploaded evidence for: ${meta?.task_title ?? ''}`;
    case 'evidence_added':         return `Added evidence for: ${meta?.task_title ?? ''}`;
    case 'evidence_version_added': return `Added new evidence version for: ${meta?.task_title ?? ''}`;
    case 'member_joined':          return 'Joined the group';
    case 'evaluation_opened':      return 'Opened peer evaluation';
    case 'evaluation_submitted':   return 'Submitted peer evaluation';
    case 'report_shared':          return 'Shared contribution record link';
    case 'report_exported':        return `Exported contribution record (${meta?.mode ?? 'PDF'})`;
    default: return action;
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const PW = 210;           // A4 width mm
const PH = 297;           // A4 height mm
const ML = 16;            // margin left
const MR = 16;            // margin right
const CW = PW - ML - MR; // 178mm content width

// Fixed (non-theme) colours
const GRAY_DARK  = [30,  30,  30]  as const;
const GRAY_MID   = [90,  90,  90]  as const;
const GRAY_LIGHT = [160, 160, 160] as const;
const GRAY_RULE  = [220, 220, 220] as const;
const GRAY_ROW   = [248, 248, 248] as const;

// Default theme (brand blue #1A56E8) — also used as the UI default
export const DEFAULT_PDF_THEME: [number, number, number] = [26, 86, 232];

// ── Colour helpers ────────────────────────────────────────────────────────────

function setColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

// Blend theme colour with white (12 / 88) to get a light tint for backgrounds
function themeLight(tc: readonly [number, number, number]): [number, number, number] {
  return [
    Math.round(tc[0] * 0.12 + 255 * 0.88),
    Math.round(tc[1] * 0.12 + 255 * 0.88),
    Math.round(tc[2] * 0.12 + 255 * 0.88),
  ];
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function sectionHeader(
  doc: jsPDF,
  label: string,
  y: number,
  tc: readonly [number, number, number],
  tcl: readonly [number, number, number]
): number {
  doc.setFillColor(tcl[0], tcl[1], tcl[2]);
  doc.roundedRect(ML, y - 4.5, CW, 8, 1.5, 1.5, 'F');
  doc.setFillColor(tc[0], tc[1], tc[2]);
  doc.rect(ML, y - 3.5, 2.5, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(doc, GRAY_DARK);
  doc.text(label, ML + 5, y);
  return y + 7;
}

function checkPage(doc: jsPDF, y: number, needed = 12): { doc: jsPDF; y: number } {
  if (y + needed > PH - 18) {
    doc.addPage();
    return { doc, y: 18 };
  }
  return { doc, y };
}

// ── Main export ───────────────────────────────────────────────────────────────

export type PdfMode = 'student' | 'teacher';

export function generateReport(
  group: Group,
  members: GroupMember[],
  tasks: Task[],
  activity: ActivityLog[],
  evidenceByTask: Record<string, Evidence[]> = {},
  evaluationSummaries: EvaluationSummary[] = [],
  themeColor: [number, number, number] = DEFAULT_PDF_THEME,
  mode: PdfMode = 'student'
): void {
  const TC  = themeColor;
  const TCL = themeLight(TC);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;

  // Pre-compute stats
  const totalTasks    = tasks.length;
  const doneTasks     = tasks.filter((t) => t.status === 'done').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const evalResponses = evaluationSummaries.length > 0
    ? Math.max(...evaluationSummaries.map((s) => s.eval_count))
    : 0;
  const leadMember = members.find((m) => m.profile_id === group.lead_id);
  const university = leadMember?.profile?.university ?? null;

  // ── Header ─────────────────────────────────────────────────────────────────

  doc.setFillColor(TC[0], TC[1], TC[2]);
  doc.rect(0, 0, PW, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(doc, GRAY_DARK);
  doc.text('Group Contribution Report', ML, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, GRAY_MID);
  const subtitle = university
    ? `${university}  ·  Generated by Contrib  ·  ${fmtDate(new Date().toISOString())}`
    : `Generated by Contrib  ·  ${fmtDate(new Date().toISOString())}`;
  doc.text(subtitle, ML, y);
  y += 6;

  doc.setDrawColor(GRAY_RULE[0], GRAY_RULE[1], GRAY_RULE[2]);
  doc.line(ML, y, PW - MR, y);
  y += 8;

  // ── Group Details ───────────────────────────────────────────────────────────

  y = sectionHeader(doc, 'Group Details', y, TC, TCL);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const details: [string, string][] = [
    ['Group name',       group.name],
    ['Subject',          group.subject],
    ['Due date',         fmtDate(group.due_date)],
    ['Members',          String(members.length)],
    ['Report generated', fmtDateTime(new Date().toISOString())],
  ];
  if (university) details.splice(2, 0, ['University', university]);

  details.forEach(([label, value]) => {
    setColor(doc, GRAY_MID);
    doc.text(label, ML + 2, y);
    setColor(doc, GRAY_DARK);
    doc.text(value, ML + 48, y);
    y += 5.5;
  });

  y += 5;

  // ── Stats summary block ─────────────────────────────────────────────────────

  ({ y } = checkPage(doc, y, 18));
  doc.setFillColor(TCL[0], TCL[1], TCL[2]);
  doc.roundedRect(ML, y, CW, 12, 2, 2, 'F');

  const stats = [
    { label: 'Members',    value: String(members.length) },
    { label: 'Tasks',      value: String(totalTasks) },
    { label: 'Complete',   value: `${completionPct}%` },
    { label: 'Peer Review', value: evaluationSummaries.length > 0 ? `${evalResponses} responses` : 'Not opened' },
  ];

  const statW = CW / stats.length;
  stats.forEach((s, i) => {
    const sx = ML + i * statW + statW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(TC[0], TC[1], TC[2]);
    doc.text(s.value, sx, y + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, GRAY_MID);
    doc.text(s.label, sx, y + 9.5, { align: 'center' });
  });

  y += 18;

  // ── Teacher Executive Summary (teacher mode only) ─────────────────────────

  if (mode === 'teacher') {
    ({ y } = checkPage(doc, y, 40));
    y = sectionHeader(doc, 'Executive Summary', y, TC, TCL);
    y += 4;

    // Pre-compute summary data
    const membersAtRisk = members.filter((m) => {
      const mt = tasks.filter((t) => t.assignee_id === m.profile_id);
      if (mt.length === 0) return false;
      const pct = Math.round((mt.filter((t) => t.status === 'done').length / mt.length) * 100);
      return pct < 25;
    });
    const membersNoEvidence = members.filter((m) => {
      const mt = tasks.filter((t) => t.assignee_id === m.profile_id && t.status === 'done');
      return mt.length > 0 && mt.every((t) => !evidenceByTask[t.id] || evidenceByTask[t.id].length === 0);
    });
    const isPastDue = group.due_date && new Date(group.due_date) < new Date();
    const evalResponseRate = evaluationSummaries.length > 0
      ? `${Math.max(...evaluationSummaries.map((s) => s.eval_count))}/${members.length - 1} submitted`
      : 'Not opened';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const summaryItems: [string, string, readonly [number, number, number]][] = [
      ['Overall completion', `${completionPct}% complete (${doneTasks}/${totalTasks} tasks)`, completionPct >= 75 ? [22, 163, 74] : completionPct >= 50 ? GRAY_DARK : [220, 38, 38]],
      ['Due date', isPastDue ? `OVERDUE — was ${fmtDate(group.due_date)}` : group.due_date ? fmtDate(group.due_date) : 'Not set', isPastDue ? [220, 38, 38] : GRAY_DARK],
      ['Peer review', evalResponseRate, GRAY_DARK],
    ];

    if (membersAtRisk.length > 0) {
      summaryItems.push([
        'Members at risk (<25%)',
        membersAtRisk.map((m) => m.profile?.name ?? 'Unknown').join(', '),
        [220, 38, 38],
      ]);
    }
    if (membersNoEvidence.length > 0) {
      summaryItems.push([
        'No evidence attached',
        membersNoEvidence.map((m) => m.profile?.name ?? 'Unknown').join(', '),
        [220, 38, 38],
      ]);
    }

    summaryItems.forEach(([label, value, color]) => {
      setColor(doc, GRAY_MID);
      doc.text(label, ML + 2, y);
      setColor(doc, color);
      doc.setFont('helvetica', 'bold');
      doc.text(value, ML + 52, y, { maxWidth: CW - 54 });
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 5;
  }

  // ── Member Contribution Summary ─────────────────────────────────────────────

  ({ y } = checkPage(doc, y, 40));
  y = sectionHeader(doc, 'Member Contribution Summary', y, TC, TCL);
  y += 4;

  // Columns: name:65  assigned:33  done:30  completion:50 → 178 ✓
  const colName = 65; const colAssigned = 33; const colDone = 30;
  const xName     = ML + 2;
  const xAssigned = ML + colName + colAssigned - 3;
  const xDone     = ML + colName + colAssigned + colDone - 3;
  const xCompl    = ML + CW - 3;
  const ROW_H = 11; // tall enough for name + academic sub-line

  // Header row
  doc.setFillColor(235, 235, 235);
  doc.rect(ML, y, CW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, GRAY_DARK);
  doc.text('Member',     xName,     y + 5);
  doc.text('Assigned',   xAssigned, y + 5, { align: 'right' });
  doc.text('Done',       xDone,     y + 5, { align: 'right' });
  doc.text('Completion', xCompl,    y + 5, { align: 'right' });
  y += 9;

  members.forEach((m, idx) => {
    ({ y } = checkPage(doc, y, ROW_H + 2));

    const memberTasks = tasks.filter((t) => t.assignee_id === m.profile_id);
    const mDone       = memberTasks.filter((t) => t.status === 'done');
    const pct         = memberTasks.length > 0 ? Math.round((mDone.length / memberTasks.length) * 100) : 0;
    const name        = m.profile?.name ?? m.profile_id;
    const isLead      = m.profile_id === group.lead_id;
    const academic    = [
      m.profile?.year_of_study ?? '',
      m.profile?.faculty ?? '',
    ].filter(Boolean).join(' · ');

    if (idx % 2 === 0) {
      doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
      doc.rect(ML, y, CW, ROW_H, 'F');
    }

    const ty = y + 4;

    // Name
    doc.setFont('helvetica', isLead ? 'bold' : 'normal');
    doc.setFontSize(9);
    setColor(doc, GRAY_DARK);
    doc.text(isLead ? `${name} (Lead)` : name, xName, ty, { maxWidth: colName - 4 });

    // Academic sub-line
    if (academic) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setColor(doc, GRAY_LIGHT);
      doc.text(academic, xName, ty + 4, { maxWidth: colName - 4 });
    }

    // Numbers
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, GRAY_MID);
    doc.text(String(memberTasks.length), xAssigned, ty, { align: 'right' });

    if (mDone.length > 0) { doc.setTextColor(22, 163, 74); } else { setColor(doc, GRAY_LIGHT); }
    doc.text(String(mDone.length), xDone, ty, { align: 'right' });

    if (pct === 100) { doc.setTextColor(TC[0], TC[1], TC[2]); } else { setColor(doc, GRAY_DARK); }
    doc.text(`${pct}%`, xCompl, ty, { align: 'right' });

    y += ROW_H;
    doc.setDrawColor(GRAY_RULE[0], GRAY_RULE[1], GRAY_RULE[2]);
    doc.line(ML, y, PW - MR, y);
  });

  y += 8;

  // ── Visual Contribution Chart ───────────────────────────────────────────────

  ({ y } = checkPage(doc, y, members.length * 9 + 20));
  y = sectionHeader(doc, 'Contribution Chart', y, TC, TCL);
  y += 5;

  const BAR_LABEL_W = 55;
  const BAR_MAX_W   = 100;
  const BAR_H       = 5;
  const BAR_ROW     = 9;

  members.forEach((m, idx) => {
    ({ y } = checkPage(doc, y, BAR_ROW + 2));

    const memberTasks = tasks.filter((t) => t.assignee_id === m.profile_id);
    const mDone       = memberTasks.filter((t) => t.status === 'done');
    const pct         = memberTasks.length > 0 ? Math.round((mDone.length / memberTasks.length) * 100) : 0;
    const barFill     = (pct / 100) * BAR_MAX_W;
    const name        = m.profile?.name ?? m.profile_id;

    if (idx % 2 === 0) {
      doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
      doc.rect(ML, y - 1, CW, BAR_ROW, 'F');
    }

    // Name label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, GRAY_DARK);
    doc.text(name, ML + 2, y + 3.5, { maxWidth: BAR_LABEL_W - 4 });

    // Track
    const barX = ML + BAR_LABEL_W;
    doc.setFillColor(GRAY_RULE[0], GRAY_RULE[1], GRAY_RULE[2]);
    doc.roundedRect(barX, y + 1, BAR_MAX_W, BAR_H, 1.5, 1.5, 'F');

    // Fill
    if (barFill > 3) {
      doc.setFillColor(TC[0], TC[1], TC[2]);
      doc.roundedRect(barX, y + 1, barFill, BAR_H, 1.5, 1.5, 'F');
    } else if (barFill > 0) {
      doc.setFillColor(TC[0], TC[1], TC[2]);
      doc.rect(barX, y + 1, barFill, BAR_H, 'F');
    }

    // % label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    if (pct === 100) { doc.setTextColor(TC[0], TC[1], TC[2]); } else { setColor(doc, GRAY_MID); }
    doc.text(`${pct}%`, ML + BAR_LABEL_W + BAR_MAX_W + 21, y + 4.5, { align: 'right' });

    y += BAR_ROW;
  });

  y += 8;

  // ── Per-Member Task Details ─────────────────────────────────────────────────

  ({ y } = checkPage(doc, y, 20));
  y = sectionHeader(doc, 'Per-Member Task Details', y, TC, TCL);
  y += 4;

  members.forEach((m) => {
    const name           = m.profile?.name ?? m.profile_id;
    const memberTasks    = tasks.filter((t) => t.assignee_id === m.profile_id);
    const completedTasks = memberTasks.filter((t) => t.status === 'done');
    const pendingTasks   = memberTasks.filter((t) => t.status !== 'done');

    ({ y } = checkPage(doc, y, 16));

    // Member subheader
    doc.setFillColor(245, 245, 245);
    doc.rect(ML, y - 3.5, CW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setColor(doc, GRAY_DARK);
    doc.text(name, ML + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, GRAY_MID);
    doc.text(`${completedTasks.length}/${memberTasks.length} tasks done`, PW - MR - 2, y, { align: 'right' });
    y += 7;

    if (memberTasks.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      setColor(doc, GRAY_LIGHT);
      doc.text('No tasks assigned.', ML + 4, y);
      y += 5;
    } else {
      // Completed tasks — filled bullet
      completedTasks.forEach((t) => {
        ({ y } = checkPage(doc, y, 14));

        doc.setFillColor(TC[0], TC[1], TC[2]);
        doc.circle(ML + 3, y - 1, 0.8, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        setColor(doc, GRAY_DARK);
        doc.text(t.title, ML + 6, y, { maxWidth: CW - 6 });
        y += 4;

        // Completed date (left) + evidence content (right)
        doc.setFontSize(7.5);
        if (t.completed_at) {
          setColor(doc, GRAY_LIGHT);
          doc.text(`Completed ${fmtDateTime(t.completed_at)}`, ML + 6, y);
        }

        const taskEvidence = evidenceByTask[t.id] ?? [];
        if (taskEvidence.length > 0) {
          const latest = taskEvidence[taskEvidence.length - 1];
          const label  = latest.type === 'note'
            ? `[note] ${truncate(latest.content, 50)}`
            : `[${latest.type}] ${truncate(latest.content, 45)}`;
          doc.setTextColor(22, 163, 74);
          doc.text(label, PW - MR - 2, y, { align: 'right', maxWidth: 90 });
        } else {
          setColor(doc, GRAY_LIGHT);
          doc.text('[no evidence]', PW - MR - 2, y, { align: 'right' });
        }

        setColor(doc, GRAY_DARK);
        y += 5;
      });

      // Incomplete tasks — hollow bullet
      pendingTasks.forEach((t) => {
        ({ y } = checkPage(doc, y, 10));

        doc.setDrawColor(GRAY_LIGHT[0], GRAY_LIGHT[1], GRAY_LIGHT[2]);
        doc.circle(ML + 3, y - 1, 0.8, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        setColor(doc, GRAY_LIGHT);
        const statusLabel = t.status === 'inprogress' ? 'In Progress' : 'To Do';
        doc.text(`${t.title}  [${statusLabel}]`, ML + 6, y, { maxWidth: CW - 6 });
        y += 5;
      });
    }

    y += 4;
  });

  // ── Activity Timeline ───────────────────────────────────────────────────────

  ({ y } = checkPage(doc, y, 20));
  y = sectionHeader(doc, 'Full Timeline', y, TC, TCL);
  y += 4;

  const TIME_COL  = 38;
  const ACTOR_COL = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, GRAY_MID);
  doc.text('Date & Time', ML + 2,                      y);
  doc.text('Member',      ML + TIME_COL + 2,            y);
  doc.text('Action',      ML + TIME_COL + ACTOR_COL + 2, y);
  y += 4;

  doc.setDrawColor(GRAY_RULE[0], GRAY_RULE[1], GRAY_RULE[2]);
  doc.line(ML, y, PW - MR, y);
  y += 3;

  const sorted = [...activity].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  sorted.forEach((entry, idx) => {
    ({ y } = checkPage(doc, y, 6));

    const actor = entry.actor?.name ?? entry.actor_id;
    const label = actionLabel(entry.action, entry.meta as Record<string, unknown> | null);

    if (idx % 2 === 0) {
      doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
      doc.rect(ML, y - 3.5, CW, 5.5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, GRAY_LIGHT);
    doc.text(fmtDateTime(entry.created_at), ML + 2, y);
    setColor(doc, GRAY_MID);
    doc.text(actor, ML + TIME_COL + 2, y, { maxWidth: ACTOR_COL - 2 });
    setColor(doc, GRAY_DARK);
    doc.text(label, ML + TIME_COL + ACTOR_COL + 2, y, { maxWidth: CW - TIME_COL - ACTOR_COL - 2 });
    y += 5.5;
  });

  // ── Peer Evaluation Summary (teacher mode only) ────────────────────────────

  if (mode === 'teacher' && evaluationSummaries.length > 0) {
    ({ y } = checkPage(doc, y, 20));
    y = sectionHeader(doc, 'Peer Review Summary', y, TC, TCL);
    y += 4;

    const eColName = 70; const eColC = 40; const eColCol = 40;
    const xEName   = ML + 2;
    const xEC      = ML + eColName + eColC - 3;
    const xECol    = ML + eColName + eColC + eColCol - 3;
    const xEResp   = ML + CW - 3;
    const E_ROW_H  = 7;
    const E_TY     = 4.5;

    doc.setFillColor(235, 235, 235);
    doc.rect(ML, y, CW, E_ROW_H + 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setColor(doc, GRAY_DARK);
    doc.text('Member',        xEName, y + E_TY);
    doc.text('Contribution',  xEC,    y + E_TY, { align: 'right' });
    doc.text('Collaboration', xECol,  y + E_TY, { align: 'right' });
    doc.text('Responses',     xEResp, y + E_TY, { align: 'right' });
    y += E_ROW_H + 1;

    members.forEach((m, idx) => {
      ({ y } = checkPage(doc, y, E_ROW_H + 2));
      const s      = evaluationSummaries.find((s) => s.evaluatee_id === m.profile_id);
      const name   = m.profile?.name ?? m.profile_id;
      const isLead = m.profile_id === group.lead_id;

      if (idx % 2 === 0) {
        doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
        doc.rect(ML, y, CW, E_ROW_H, 'F');
      }

      const ty = y + E_TY;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(doc, GRAY_DARK);
      doc.text(isLead ? `${name} (Lead)` : name, xEName, ty, { maxWidth: eColName - 4 });

      if (s) {
        setColor(doc, GRAY_DARK);
        doc.text(`${s.avg_contribution} / 5`, xEC,    ty, { align: 'right' });
        doc.text(`${s.avg_collaboration} / 5`, xECol,  ty, { align: 'right' });
        setColor(doc, GRAY_MID);
        doc.text(String(s.eval_count), xEResp, ty, { align: 'right' });
      } else {
        setColor(doc, GRAY_LIGHT);
        doc.text('—', xEC,    ty, { align: 'right' });
        doc.text('—', xECol,  ty, { align: 'right' });
        doc.text('0', xEResp, ty, { align: 'right' });
      }

      y += E_ROW_H;
      doc.setDrawColor(GRAY_RULE[0], GRAY_RULE[1], GRAY_RULE[2]);
      doc.line(ML, y, PW - MR, y);
    });

    const allComments = evaluationSummaries.flatMap((s) => s.comments ?? []);
    if (allComments.length > 0) {
      y += 6;
      ({ y } = checkPage(doc, y, 12));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      setColor(doc, GRAY_MID);
      doc.text('Anonymous Comments', ML + 2, y);
      y += 5;
      allComments.forEach((comment) => {
        ({ y } = checkPage(doc, y, 8));
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        setColor(doc, GRAY_MID);
        doc.text(`"${comment}"`, ML + 4, y, { maxWidth: CW - 6 });
        y += 5;
      });
    }

    y += 6;
  }

  // ── Footer (every page) ─────────────────────────────────────────────────────

  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(TC[0], TC[1], TC[2]);
    doc.rect(0, PH - 8, PW, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const footerText = mode === 'student'
      ? `Generated by Contrib  ·  This report contains personal data of group members  ·  Page ${i} of ${pageCount}`
      : `Generated by Contrib  ·  Activity data is automatically recorded  ·  Page ${i} of ${pageCount}`;
    doc.text(footerText, PW / 2, PH - 3, { align: 'center' });
  }

  doc.save(`contrib-report-${group.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
