-- ServiceDesk AI V2 Wave 2B.1: commercial organization, portfolio and contract foundation.
-- This migration preserves V1 customer/property identity and does not introduce new scheduling or payment authority.

create table if not exists public.workspace_feature_flags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feature_key text not null check (length(trim(feature_key)) between 1 and 80),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, feature_key)
);

create table if not exists public.commercial_organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  legal_name text,
  reference text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, reference)
);

create table if not exists public.commercial_portfolio_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  customer_id uuid not null,
  title text,
  authorized_requester boolean not null default false,
  billing_contact boolean not null default false,
  operations_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, organization_id, customer_id),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete cascade,
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete restrict,
  check (authorized_requester or billing_contact or operations_contact)
);

create table if not exists public.commercial_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  property_id uuid not null,
  site_code text,
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, property_id),
  unique (workspace_id, organization_id, site_code),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete cascade,
  foreign key (workspace_id, property_id)
    references public.properties(workspace_id, id) on delete restrict
);

create table if not exists public.commercial_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  contract_number text not null check (length(trim(contract_number)) between 1 and 100),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','SUSPENDED','ENDED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, contract_number),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete restrict
);

create table if not exists public.commercial_contract_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid not null,
  version_number integer not null check (version_number > 0),
  state text not null default 'DRAFT' check (state in ('DRAFT','APPROVED','SUPERSEDED')),
  effective_from date not null,
  effective_to date,
  currency char(3) not null,
  rate_snapshot jsonb not null default '{}'::jsonb,
  approval_authority jsonb not null default '{}'::jsonb,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, contract_id, version_number),
  foreign key (workspace_id, contract_id)
    references public.commercial_contracts(workspace_id, id) on delete restrict,
  check (effective_to is null or effective_to >= effective_from),
  check (
    (state = 'DRAFT' and approved_by_user_id is null and approved_at is null)
    or (state in ('APPROVED','SUPERSEDED') and approved_by_user_id is not null and approved_at is not null)
  )
);

create table if not exists public.commercial_contract_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_version_id uuid not null,
  site_id uuid not null,
  service_id uuid not null,
  scope_snapshot jsonb not null default '{}'::jsonb,
  service_level_target_minutes integer check (service_level_target_minutes is null or service_level_target_minutes > 0),
  availability_snapshot jsonb not null default '{}'::jsonb,
  rate_override_snapshot jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, contract_version_id, site_id, service_id),
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, site_id)
    references public.commercial_sites(workspace_id, id) on delete restrict,
  foreign key (workspace_id, service_id)
    references public.service_catalog(workspace_id, id) on delete restrict
);

create table if not exists public.commercial_site_service_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_version_id uuid not null,
  contract_site_id uuid not null,
  recurrence_rule_id uuid,
  frequency public.recurrence_frequency not null,
  timezone text not null check (length(trim(timezone)) > 0),
  local_start_time time not null,
  starts_on date not null,
  ends_on date,
  preferred_window_start time,
  preferred_window_end time,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ENDED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, recurrence_rule_id),
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_site_id)
    references public.commercial_contract_sites(workspace_id, id) on delete restrict,
  foreign key (workspace_id, recurrence_rule_id)
    references public.recurrence_rules(workspace_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  check (
    (preferred_window_start is null and preferred_window_end is null)
    or (preferred_window_start is not null and preferred_window_end is not null and preferred_window_end > preferred_window_start)
  )
);

create table if not exists public.commercial_exception_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid,
  site_id uuid not null,
  visit_id uuid,
  type text not null check (type in ('DENIED_ACCESS','MISSED_VISIT','EXTRA_WORK')),
  state text not null default 'OPEN' check (state in ('OPEN','IN_REVIEW','RESOLVED','REJECTED')),
  summary text not null check (length(trim(summary)) between 1 and 1000),
  owner_user_id uuid references auth.users(id) on delete set null,
  requested_adjustment_kind text check (requested_adjustment_kind in ('CREDIT','CHARGE')),
  requested_adjustment_minor integer check (requested_adjustment_minor is null or requested_adjustment_minor > 0),
  requested_adjustment_currency char(3),
  resolution_note text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_id)
    references public.commercial_contracts(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete restrict,
  foreign key (workspace_id, site_id)
    references public.commercial_sites(workspace_id, id) on delete restrict,
  foreign key (workspace_id, visit_id)
    references public.visits(workspace_id, id) on delete restrict,
  check (
    (requested_adjustment_kind is null and requested_adjustment_minor is null and requested_adjustment_currency is null)
    or (requested_adjustment_kind is not null and requested_adjustment_minor is not null and requested_adjustment_currency is not null)
  )
);

create index if not exists commercial_organizations_workspace_status_idx
  on public.commercial_organizations(workspace_id, status, display_name);
create index if not exists commercial_sites_org_idx
  on public.commercial_sites(workspace_id, organization_id, active);
create index if not exists commercial_contracts_org_status_idx
  on public.commercial_contracts(workspace_id, organization_id, status);
create index if not exists commercial_contract_versions_effective_idx
  on public.commercial_contract_versions(workspace_id, contract_id, effective_from, effective_to);
create index if not exists commercial_service_plans_status_idx
  on public.commercial_site_service_plans(workspace_id, status, starts_on);
create index if not exists commercial_exception_cases_queue_idx
  on public.commercial_exception_cases(workspace_id, state, type, updated_at desc);

alter table public.workspace_feature_flags enable row level security;
alter table public.commercial_organizations enable row level security;
alter table public.commercial_portfolio_contacts enable row level security;
alter table public.commercial_sites enable row level security;
alter table public.commercial_contracts enable row level security;
alter table public.commercial_contract_versions enable row level security;
alter table public.commercial_contract_sites enable row level security;
alter table public.commercial_site_service_plans enable row level security;
alter table public.commercial_exception_cases enable row level security;

-- Contract-first release: owner/dispatcher may read commercial data, while all direct writes remain service-role-only.
create policy workspace_feature_flags_staff_select on public.workspace_feature_flags
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_organizations_staff_select on public.commercial_organizations
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_portfolio_contacts_staff_select on public.commercial_portfolio_contacts
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_sites_staff_select on public.commercial_sites
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_contracts_staff_select on public.commercial_contracts
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_contract_versions_staff_select on public.commercial_contract_versions
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_contract_sites_staff_select on public.commercial_contract_sites
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_service_plans_staff_select on public.commercial_site_service_plans
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
create policy commercial_exception_cases_staff_select on public.commercial_exception_cases
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.workspace_feature_flags from anon, authenticated;
revoke all on table public.commercial_organizations from anon, authenticated;
revoke all on table public.commercial_portfolio_contacts from anon, authenticated;
revoke all on table public.commercial_sites from anon, authenticated;
revoke all on table public.commercial_contracts from anon, authenticated;
revoke all on table public.commercial_contract_versions from anon, authenticated;
revoke all on table public.commercial_contract_sites from anon, authenticated;
revoke all on table public.commercial_site_service_plans from anon, authenticated;
revoke all on table public.commercial_exception_cases from anon, authenticated;

grant select on table public.workspace_feature_flags to authenticated;
grant select on table public.commercial_organizations to authenticated;
grant select on table public.commercial_portfolio_contacts to authenticated;
grant select on table public.commercial_sites to authenticated;
grant select on table public.commercial_contracts to authenticated;
grant select on table public.commercial_contract_versions to authenticated;
grant select on table public.commercial_contract_sites to authenticated;
grant select on table public.commercial_site_service_plans to authenticated;
grant select on table public.commercial_exception_cases to authenticated;

grant all on table public.workspace_feature_flags to service_role;
grant all on table public.commercial_organizations to service_role;
grant all on table public.commercial_portfolio_contacts to service_role;
grant all on table public.commercial_sites to service_role;
grant all on table public.commercial_contracts to service_role;
grant all on table public.commercial_contract_versions to service_role;
grant all on table public.commercial_contract_sites to service_role;
grant all on table public.commercial_site_service_plans to service_role;
grant all on table public.commercial_exception_cases to service_role;

comment on table public.workspace_feature_flags is
  'Workspace-scoped feature activation. Absence or enabled=false means the feature is unavailable.';
comment on table public.commercial_sites is
  'Commercial portfolio site that references, rather than replaces, the authoritative V1 property row.';
comment on table public.commercial_site_service_plans is
  'Contract service-plan intent. Existing recurrence_rules remain the scheduling/materialization authority when recurrence_rule_id is linked.';
comment on table public.commercial_exception_cases is
  'Auditable commercial exception/request record. Requested credits or charges do not mutate invoice or ledger truth.';
