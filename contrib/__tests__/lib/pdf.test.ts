import { describe, it, expect, vi } from 'vitest';

// Track the most recently created jsPDF instance so tests can inspect it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastMockDoc: Record<string, any> | null = null;

vi.mock('jspdf', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockJsPDF = function (this: Record<string, any>) {
    this.setFontSize = vi.fn().mockReturnThis();
    this.setFont = vi.fn().mockReturnThis();
    this.setTextColor = vi.fn().mockReturnThis();
    this.setDrawColor = vi.fn().mockReturnThis();
    this.setFillColor = vi.fn().mockReturnThis();
    this.setLineWidth = vi.fn().mockReturnThis();
    this.text = vi.fn().mockReturnThis();
    this.line = vi.fn().mockReturnThis();
    this.rect = vi.fn().mockReturnThis();
    this.roundedRect = vi.fn().mockReturnThis();
    this.circle = vi.fn().mockReturnThis();
    this.addPage = vi.fn().mockReturnThis();
    this.setPage = vi.fn().mockReturnThis();
    this.save = vi.fn();
    this.getStringUnitWidth = vi.fn().mockReturnValue(10);
    this.internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      getNumberOfPages: () => 1,
    };
    lastMockDoc = this;
  };
  return { default: MockJsPDF };
});

import { generateReport } from '@/lib/pdf';
import type { Group, GroupMember, Task, ActivityLog, Evidence, EvaluationSummary } from '@/types';

const mockGroup: Group = {
  id: 'g1', name: 'Test Group', subject: 'CS', due_date: '2026-04-01',
  lead_id: 'u1', invite_token: 'abc123', course_id: null, created_at: '2026-01-01',
};

const mockMembers: GroupMember[] = [
  {
    id: 'm1', group_id: 'g1', profile_id: 'u1', joined_at: '2026-01-01',
    profile: { id: 'u1', name: 'Alice', university: 'EAMU', faculty: 'CS', year_of_study: '3', role: 'student', avatar_url: null, created_at: '2026-01-01' },
  },
];

const mockTasks: Task[] = [
  {
    id: 't1', group_id: 'g1', title: 'Wireframes', assignee_id: 'u1', status: 'done',
    deleted_at: null, created_at: '2026-01-02', description: null, due_date: null,
    evidence_url: null, completed_at: null,
  },
];

const mockActivity: ActivityLog[] = [
  {
    id: 'a1', group_id: 'g1', actor_id: 'u1', action: 'task_created' as const,
    task_id: null, meta: { task_title: 'Wireframes' }, created_at: '2026-01-02',
  },
];

const mockEvidence: Record<string, Evidence[]> = {};
const mockEvalSummaries: EvaluationSummary[] = [];

describe('generateReport', () => {
  it('has expected parameter count', () => {
    expect(generateReport.length).toBe(4);
  });

  it('does not throw with valid data', () => {
    expect(() =>
      generateReport(mockGroup, mockMembers, mockTasks, mockActivity, mockEvidence, mockEvalSummaries)
    ).not.toThrow();
  });

  it('does not throw with empty arrays', () => {
    expect(() =>
      generateReport(mockGroup, [], [], [], {}, [])
    ).not.toThrow();
  });

  it('does not throw with missing optional params', () => {
    expect(() =>
      generateReport(mockGroup, mockMembers, mockTasks, mockActivity)
    ).not.toThrow();
  });

  it('calls jsPDF save', () => {
    generateReport(mockGroup, mockMembers, mockTasks, mockActivity);
    expect(lastMockDoc).not.toBeNull();
    expect(lastMockDoc!.save).toHaveBeenCalled();
  });
});
