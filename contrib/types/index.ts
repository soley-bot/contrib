export interface Profile {
  id: string;
  name: string;
  university: string;
  faculty: string | null;
  year_of_study: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  subject: string;
  due_date: string | null;
  lead_id: string;
  invite_token: string;
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
  created_at: string;
  assignee?: Profile;
}

export type ActivityAction =
  | 'task_created'
  | 'task_assigned'
  | 'task_updated'
  | 'task_done'
  | 'file_uploaded'
  | 'member_joined';

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
