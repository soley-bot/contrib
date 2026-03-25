export type UserRole = 'student' | 'teacher';

export interface Profile {
  id: string;
  name: string;
  university: string;
  faculty: string | null;
  year_of_study: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  subject: string;
  due_date: string | null;
  lead_id: string;
  invite_token: string;
  course_id: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string;
  joined_at: string;
  profile?: Profile;
}

export type TaskStatus = 'todo' | 'inprogress' | 'done';

export interface Task {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  status: TaskStatus;
  due_date: string | null;
  evidence_url: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  assignee?: Profile;
}

export type EvidenceType = 'file' | 'link' | 'note';

export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  type: EvidenceType;
  content: string;
  version_number: number;
  created_at: string;
  uploader?: Profile;
}

export type ActivityAction =
  | 'task_created'
  | 'task_assigned'
  | 'task_updated'
  | 'task_done'
  | 'file_uploaded'
  | 'evidence_added'
  | 'evidence_version_added'
  | 'member_joined'
  | 'task_edited'
  | 'task_deleted'
  | 'task_reassigned'
  | 'group_updated'
  | 'member_left'
  | 'member_removed'
  | 'lead_transferred'
  | 'evaluation_opened'
  | 'evaluation_submitted'
  | 'report_shared'
  | 'report_exported';

export interface ActivityLog {
  id: string;
  group_id: string;
  actor_id: string;
  action: ActivityAction;
  task_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor?: Profile;
}

export interface Course {
  id: string;
  name: string;
  subject: string;
  teacher_id: string;
  invite_token: string;
  created_at: string;
}

export interface GroupWithStats {
  group: Group;
  memberCount: number;
  taskTotal: number;
  taskDone: number;
}

export interface EvaluationSession {
  id: string;
  group_id: string;
  opened_by: string;
  opened_at: string;
}

export interface Evaluation {
  id: string;
  group_id: string;
  evaluator_id: string;
  evaluatee_id: string;
  contribution_score: number;
  collaboration_score: number;
  comment: string | null;
  submitted_at: string;
}

export interface EvaluationSummary {
  group_id: string;
  evaluatee_id: string;
  avg_contribution: number;
  avg_collaboration: number;
  eval_count: number;
  comments: string[] | null;
}

export interface ReportShare {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}
