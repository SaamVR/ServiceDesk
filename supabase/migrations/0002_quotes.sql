-- ServiceDesk AI V1 Task 1.2: quote catalog, snapshots and approvals
create type public.quote_status as enum ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','SUPERSEDED');
create type public.approval_status as enum ('PENDING','APPROVED','REJECTED','SUPERSEDED');

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version text not null,
  currency char(3) not null default 'USD',
  deposit_percent integer not null default 25 check (deposit_percent between 0 and 100),
  valid_hours integer not null default 48 check (valid_hours > 0),
  buffer_minutes integer not null default 30 check (buffer_minutes >= 0),
  active boolean not null default false,
  rules jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, version)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null,
  version bigint not null check (version > 0),
  status public.quote_status not null default 'DRAFT',
  service_code text not null,
  currency char(3) not null,
  subtotal_minor integer not null check (subtotal_minor >= 0),
  tax_minor integer not null default 0 check (tax_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  deposit_minor integer not null check (deposit_minor >= 0),
  balance_minor integer not null check (balance_minor >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_minutes integer not null default 30 check (buffer_minutes >= 0),
  rate_version text not null,
  valid_until timestamptz not null,
  snapshot jsonb not null,
  superseded_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, request_id, version),
  foreign key (workspace_id, request_id) references public.requests(workspace_id, id) on delete restrict,
  foreign key (workspace_id, superseded_by) references public.quotes(workspace_id, id),
  check (subtotal_minor + tax_minor = total_minor),
  check (deposit_minor + balance_minor = total_minor)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quote_id uuid not null,
  code text not null,
  description text not null,
  amount_minor integer not null check (amount_minor >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id) on delete cascade
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quote_id uuid not null,
  quote_version bigint not null check (quote_version > 0),
  status public.approval_status not null default 'PENDING',
  reason text,
  requested_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id) on delete cascade
);

create index quotes_request_idx on public.quotes(workspace_id, request_id, version desc);
create index quotes_status_idx on public.quotes(workspace_id, status, valid_until);
create index quote_items_quote_idx on public.quote_items(workspace_id, quote_id, sort_order);
create index approvals_quote_idx on public.approvals(workspace_id, quote_id, quote_version);

alter table public.rate_cards enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.approvals enable row level security;

create policy rate_cards_staff_select on public.rate_cards
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy quotes_staff_all on public.quotes
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy quotes_customer_select on public.quotes
for select to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.workspace_id = quotes.workspace_id
      and r.id = quotes.request_id
      and r.customer_id is not null
      and public.is_customer_for_workspace(r.workspace_id, r.customer_id)
  )
);

create policy quote_items_staff_select on public.quote_items
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy quote_items_customer_select on public.quote_items
for select to authenticated
using (
  exists (
    select 1
    from public.quotes q
    join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = quote_items.workspace_id
      and q.id = quote_items.quote_id
      and r.customer_id is not null
      and public.is_customer_for_workspace(r.workspace_id, r.customer_id)
  )
);

create policy approvals_staff_all on public.approvals
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
