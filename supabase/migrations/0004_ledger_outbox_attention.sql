-- ServiceDesk AI V1 Task 2.2: ledger, outbox and attention center
create type public.ledger_direction as enum ('DEBIT','CREDIT');
create type public.outbox_status as enum ('PENDING','SENT','FAILED');
create type public.attention_severity as enum ('INFO','WARNING','CRITICAL');
create type public.attention_status as enum ('OPEN','ACKNOWLEDGED','RESOLVED');

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  direction public.ledger_direction not null,
  amount_minor integer not null check (amount_minor > 0),
  currency char(3) not null,
  idempotency_key text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic text not null,
  payload jsonb not null,
  status public.outbox_status not null default 'PENDING',
  attempts integer not null default 0 check (attempts >= 0),
  idempotency_key text not null,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key)
);

create table public.attention_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  resource_type text not null,
  resource_id uuid not null,
  severity public.attention_severity not null,
  status public.attention_status not null default 'OPEN',
  summary text not null,
  owner_user_id uuid references auth.users(id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index attention_open_dedupe_idx
on public.attention_items(workspace_id, type, resource_type, resource_id)
where status = 'OPEN';

create index ledger_resource_idx on public.ledger_entries(workspace_id, resource_type, resource_id, occurred_at desc);
create index outbox_pending_idx on public.outbox_events(workspace_id, status, coalesce(next_attempt_at, created_at))
where status = 'PENDING';
create index attention_open_idx on public.attention_items(workspace_id, severity, created_at desc)
where status = 'OPEN';

alter table public.ledger_entries enable row level security;
alter table public.outbox_events enable row level security;
alter table public.attention_items enable row level security;

create policy ledger_staff_select on public.ledger_entries
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy ledger_staff_insert on public.ledger_entries
for insert to authenticated
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy outbox_staff_select on public.outbox_events
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

-- Outbox writes should normally be done by the trusted server runtime/service role.
-- This policy only allows staff-visible diagnostic inserts in non-provider tests.
create policy outbox_staff_insert on public.outbox_events
for insert to authenticated
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy attention_staff_all on public.attention_items
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy attention_crew_select on public.attention_items
for select to authenticated
using (public.has_active_membership(workspace_id, array['CREW']::public.membership_role[]));
