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
