-- Run this in your Supabase SQL editor to create all required tables.
-- Tables are created first, then all RLS policies (avoids forward-reference errors).

-- ── TABLES ────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  university text not null,
  faculty text,
  year_of_study text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  due_date date,
  lead_id uuid not null references public.profiles(id),
  invite_token text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid not null references public.profiles(id),
  status text not null default 'todo' check (status in ('todo', 'inprogress', 'done')),
  due_date date,
  evidence_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.evidence (
  id             uuid        primary key default gen_random_uuid(),
  task_id        uuid        not null references public.tasks(id) on delete cascade,
  uploaded_by    uuid        not null references public.profiles(id),
  type           text        not null check (type in ('file', 'link', 'note')),
  content        text        not null,
  version_number integer     not null default 1,
  created_at     timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('task_created','task_assigned','task_done','file_uploaded','member_joined')),
  task_id uuid references public.tasks(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tasks enable row level security;
alter table public.evidence enable row level security;
alter table public.activity_log enable row level security;

-- profiles
create policy "Users can read all profiles"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- groups (group_members exists now, so this reference is safe)
create policy "Anyone can read group by invite token"
  on public.groups for select using (true);

create policy "Authenticated users can insert groups"
  on public.groups for insert with check (auth.uid() = lead_id);

create policy "Lead can update group"
  on public.groups for update using (auth.uid() = lead_id);

-- group_members
create policy "Members can read group_members"
  on public.group_members for select using (
    profile_id = auth.uid() or
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.profile_id = auth.uid()
    )
  );

create policy "Authenticated users can join groups"
  on public.group_members for insert with check (auth.uid() = profile_id);

-- tasks
create policy "Group members can read tasks"
  on public.tasks for select using (
    exists (
      select 1 from public.group_members
      where group_id = tasks.group_id and profile_id = auth.uid()
    )
  );

create policy "Group members can insert tasks"
  on public.tasks for insert with check (
    exists (
      select 1 from public.group_members
      where group_id = tasks.group_id and profile_id = auth.uid()
    )
  );

create policy "Assignee and lead can update tasks"
  on public.tasks for update using (
    assignee_id = auth.uid() or
    exists (
      select 1 from public.groups
      where id = tasks.group_id and lead_id = auth.uid()
    )
  );

-- evidence
create policy "Group members can view evidence"
  on public.evidence for select
  using (
    exists (
      select 1 from public.tasks t
      join public.group_members gm on gm.group_id = t.group_id
      where t.id = evidence.task_id
        and gm.profile_id = auth.uid()
    )
  );

create policy "Users can insert own evidence"
  on public.evidence for insert
  with check (auth.uid() = uploaded_by);

-- activity_log
create policy "Group members can read activity"
  on public.activity_log for select using (
    exists (
      select 1 from public.group_members
      where group_id = activity_log.group_id and profile_id = auth.uid()
    )
  );

create policy "Group members can insert activity"
  on public.activity_log for insert with check (
    exists (
      select 1 from public.group_members
      where group_id = activity_log.group_id and profile_id = auth.uid()
    )
  );

-- ── v2 MIGRATION: TEACHER ROLE + COURSES ─────────────────────────────────────

alter table public.profiles
  add column role text not null default 'student'
  check (role in ('student', 'teacher'));

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  subject      text not null,
  teacher_id   uuid not null references public.profiles(id),
  invite_token text not null unique,
  created_at   timestamptz not null default now()
);

alter table public.groups
  add column course_id uuid references public.courses(id) on delete set null;

alter table public.courses enable row level security;

create policy "Authenticated users can read courses"
  on public.courses for select using (auth.uid() is not null);

create policy "Teachers can insert their courses"
  on public.courses for insert
  with check (
    auth.uid() = teacher_id and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );

create policy "Teacher can update own course"
  on public.courses for update using (auth.uid() = teacher_id);

create policy "Teachers can read tasks in their courses"
  on public.tasks for select
  using (
    exists (
      select 1 from public.groups g
      join public.courses c on c.id = g.course_id
      where g.id = tasks.group_id and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can read activity in their courses"
  on public.activity_log for select
  using (
    exists (
      select 1 from public.groups g
      join public.courses c on c.id = g.course_id
      where g.id = activity_log.group_id and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can read group_members in their courses"
  on public.group_members for select
  using (
    exists (
      select 1 from public.groups g
      join public.courses c on c.id = g.course_id
      where g.id = group_members.group_id and c.teacher_id = auth.uid()
    )
  );

create policy "Lead can link group to course"
  on public.groups for update
  using (auth.uid() = lead_id);
