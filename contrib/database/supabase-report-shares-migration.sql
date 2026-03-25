-- ============================================================================
-- Report Shares — shareable token-based links for contribution records
-- ============================================================================

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz  -- nullable = never expires
);

-- RLS
alter table public.report_shares enable row level security;

-- Members can read their group's shares
create policy "Group members can read report shares"
  on public.report_shares for select
  using (group_id in (select group_id from public.group_members where profile_id = auth.uid()));

-- Only lead can create shares
create policy "Group lead can create report shares"
  on public.report_shares for insert
  with check (
    created_by = auth.uid()
    and group_id in (select id from public.groups where lead_id = auth.uid())
  );

-- Only lead can delete shares
create policy "Group lead can delete report shares"
  on public.report_shares for delete
  using (group_id in (select id from public.groups where lead_id = auth.uid()));

-- Indexes
create index idx_report_shares_token on public.report_shares(token);
create index idx_report_shares_group_id on public.report_shares(group_id);

-- ============================================================================
-- Evaluation Sessions — restrict insert to group lead only
-- (Existing table, adding missing RLS policy)
-- ============================================================================

create policy "Only lead can open evaluation"
  on public.evaluation_sessions for insert
  with check (
    opened_by = auth.uid()
    and group_id in (select id from public.groups where lead_id = auth.uid())
  );
