-- ServiceDesk AI V1 Task 1.1: tenant-safe CRM/request core
create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.membership_role as enum ('OWNER','DISPATCHER','CREW');
create type public.membership_status as enum ('INVITED','ACTIVE','REVOKED');
create type public.request_status as enum ('NEW','COLLECTING','READY','NEEDS_REVIEW','QUOTED','BOOKED','LOST','CLOSED');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Europe/London',
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'ACTIVE',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (length(trim(display_name)) > 0),
  lead_source text,
  notes text,
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index customers_workspace_auth_user_uq
  on public.customers(workspace_id, auth_user_id)
  where auth_user_id is not null and archived_at is null;

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  kind text not null check (kind in ('EMAIL','PHONE')),
  value text not null check (length(trim(value)) > 0),
  is_primary boolean not null default false,
  is_billing boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete cascade
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  label text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  postal_code text not null,
  country_code char(2) not null default 'GB',
  access_notes text,
  service_notes text,
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete restrict
);

create table public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  channel text not null check (channel in ('WHATSAPP','EMAIL','SMS')),
  purpose text not null,
  status text not null check (status in ('GRANTED','REVOKED','UNKNOWN')),
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete cascade
);

create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  requires_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid,
  property_id uuid,
  service_id uuid,
  visitor_session_id text,
  status public.request_status not null default 'NEW',
  bedrooms integer check (bedrooms between 0 and 10),
  bathrooms integer check (bathrooms between 0 and 10),
  requested_start_at timestamptz,
  structured_fields jsonb not null default '{}'::jsonb,
  assigned_user_id uuid references auth.users(id),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, customer_id) references public.customers(workspace_id, id),
  foreign key (workspace_id, property_id) references public.properties(workspace_id, id),
  foreign key (workspace_id, service_id) references public.service_catalog(workspace_id, id),
  check (customer_id is not null or visitor_session_id is not null)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid,
  customer_id uuid,
  channel text not null check (channel in ('WEB','WHATSAPP','EMAIL')),
  provider_thread_id text,
  assigned_user_id uuid references auth.users(id),
  handover_active boolean not null default false,
  handover_owner_revision bigint not null default 0,
  version bigint not null default 1 check (version > 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, request_id) references public.requests(workspace_id, id),
  foreign key (workspace_id, customer_id) references public.customers(workspace_id, id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  direction text not null check (direction in ('INBOUND','OUTBOUND','INTERNAL')),
  sender_kind text not null check (sender_kind in ('CUSTOMER','STAFF','AI','SYSTEM')),
  provider_message_id text,
  body text,
  attachment_count integer not null default 0 check (attachment_count >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, conversation_id)
    references public.conversations(workspace_id, id) on delete cascade
);

create unique index messages_provider_id_uq
  on public.messages(workspace_id, provider_message_id)
  where provider_message_id is not null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  request_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create index requests_workspace_status_idx on public.requests(workspace_id, status, created_at desc);
create index properties_customer_idx on public.properties(workspace_id, customer_id);
create index audit_events_resource_idx on public.audit_events(workspace_id, resource_type, resource_id, created_at desc);


create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email citext not null,
  role public.membership_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create or replace function public.has_active_membership(
  target_workspace uuid,
  allowed_roles public.membership_role[] default null
)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.is_customer_for_workspace(target_workspace uuid, target_customer uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.workspace_id = target_workspace
      and c.id = target_customer
      and c.auth_user_id = auth.uid()
      and c.archived_at is null
  );
$$;

revoke all on function public.has_active_membership(uuid, public.membership_role[]) from public;
grant execute on function public.has_active_membership(uuid, public.membership_role[]) to authenticated;
revoke all on function public.is_customer_for_workspace(uuid, uuid) from public;
grant execute on function public.is_customer_for_workspace(uuid, uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.properties enable row level security;
alter table public.communication_consents enable row level security;
alter table public.service_catalog enable row level security;
alter table public.requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.audit_events enable row level security;

create policy workspaces_staff_select on public.workspaces
for select to authenticated
using (public.has_active_membership(id, null));

create policy memberships_self_or_owner_select on public.memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
);

create policy customers_staff_all on public.customers
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy customers_customer_select on public.customers
for select to authenticated using (auth_user_id = auth.uid());

create policy contacts_staff_all on public.customer_contacts
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy contacts_customer_select on public.customer_contacts
for select to authenticated
using (public.is_customer_for_workspace(workspace_id, customer_id));

create policy properties_staff_all on public.properties
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy properties_customer_select on public.properties
for select to authenticated
using (public.is_customer_for_workspace(workspace_id, customer_id));

create policy consents_staff_all on public.communication_consents
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy catalog_staff_select on public.service_catalog
for select to authenticated
using (public.has_active_membership(workspace_id, null));

create policy requests_staff_all on public.requests
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy requests_customer_select on public.requests
for select to authenticated
using (customer_id is not null and public.is_customer_for_workspace(workspace_id, customer_id));

create policy conversations_staff_all on public.conversations
for all to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy conversations_customer_select on public.conversations
for select to authenticated
using (customer_id is not null and public.is_customer_for_workspace(workspace_id, customer_id));

create policy messages_staff_select on public.messages
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy audit_owner_select on public.audit_events
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

comment on table public.requests is
'Anonymous request creation must use a narrowly scoped server endpoint/session, never a direct anon table policy.';
