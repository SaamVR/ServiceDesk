-- ServiceDesk AI V1 Task 2.1: capacity, transactional holds, visits and recurrence
create type public.slot_hold_status as enum ('HELD','CONFIRMED','EXPIRED','RELEASED');
create type public.visit_status as enum ('SCHEDULED','ASSIGNED','EN_ROUTE','IN_PROGRESS','NEEDS_REVIEW','COMPLETED','CANCELLED');
create type public.recurrence_frequency as enum ('WEEKLY','FORTNIGHTLY','MONTHLY');

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  crew_id uuid not null,
  user_id uuid not null references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, crew_id, user_id),
  foreign key (workspace_id, crew_id) references public.crews(workspace_id, id) on delete cascade
);

create table public.capacity_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  crew_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity_minutes integer not null check (capacity_minutes > 0),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, crew_id) references public.crews(workspace_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create table public.slot_holds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slot_id uuid not null,
  quote_id uuid not null,
  status public.slot_hold_status not null default 'HELD',
  expires_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, slot_id) references public.capacity_slots(workspace_id, id) on delete restrict,
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id) on delete restrict
);

create unique index slot_holds_one_active_hold_idx
on public.slot_holds(workspace_id, slot_id)
where status = 'HELD';

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null,
  quote_id uuid,
  slot_id uuid,
  hold_id uuid,
  crew_id uuid,
  status public.visit_status not null default 'SCHEDULED',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, request_id) references public.requests(workspace_id, id) on delete restrict,
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id) on delete restrict,
  foreign key (workspace_id, slot_id) references public.capacity_slots(workspace_id, id) on delete restrict,
  foreign key (workspace_id, hold_id) references public.slot_holds(workspace_id, id) on delete restrict,
  foreign key (workspace_id, crew_id) references public.crews(workspace_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null,
  property_id uuid not null,
  frequency public.recurrence_frequency not null,
  timezone text not null,
  local_start_time time not null,
  starts_on date not null,
  ends_on date,
  max_occurrences integer check (max_occurrences is null or max_occurrences > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, request_id) references public.requests(workspace_id, id) on delete restrict,
  foreign key (workspace_id, property_id) references public.properties(workspace_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create index capacity_slots_window_idx on public.capacity_slots(workspace_id, starts_at, ends_at);
create index slot_holds_expiry_idx on public.slot_holds(workspace_id, slot_id, status, expires_at);
create index visits_schedule_idx on public.visits(workspace_id, starts_at, status);
create index visits_crew_idx on public.visits(workspace_id, crew_id, starts_at);
create index recurrence_rules_request_idx on public.recurrence_rules(workspace_id, request_id, active);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.capacity_slots enable row level security;
alter table public.slot_holds enable row level security;
alter table public.visits enable row level security;
alter table public.recurrence_rules enable row level security;

create policy crews_staff_all on public.crews
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy crew_members_staff_all on public.crew_members
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy capacity_slots_staff_all on public.capacity_slots
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy slot_holds_staff_all on public.slot_holds
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy visits_staff_all on public.visits
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy visits_crew_select on public.visits
for select to authenticated
using (
  exists (
    select 1
    from public.crew_members cm
    where cm.workspace_id = visits.workspace_id
      and cm.crew_id = visits.crew_id
      and cm.user_id = auth.uid()
      and cm.active = true
  )
);

create policy visits_customer_select on public.visits
for select to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.workspace_id = visits.workspace_id
      and r.id = visits.request_id
      and r.customer_id is not null
      and public.is_customer_for_workspace(r.workspace_id, r.customer_id)
  )
);

create policy recurrence_rules_staff_all on public.recurrence_rules
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
