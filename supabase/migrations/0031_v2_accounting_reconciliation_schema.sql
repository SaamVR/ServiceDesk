-- ServiceDesk AI V2 Wave 2B.3A: provider-neutral accounting reconciliation foundation.
-- This migration stores reconciliation metadata only. It does not contain OAuth tokens or call an accounting provider.

create table if not exists public.accounting_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  status text not null default 'DISCONNECTED'
    check (status in ('DISCONNECTED','READY','AUTH_EXPIRED','ERROR')),
  default_sync_owner text not null default 'SERVICEDESK'
    check (default_sync_owner in ('SERVICEDESK','EXTERNAL')),
  last_success_at timestamptz,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider)
);

create table if not exists public.accounting_reconciliation_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  integration_id uuid not null,
  entity_type text not null check (entity_type in ('CONTACT','INVOICE','PAYMENT','CREDIT')),
  local_resource_id uuid not null,
  local_version bigint not null check (local_version > 0),
  external_id text,
  external_version text,
  sync_owner text not null check (sync_owner in ('SERVICEDESK','EXTERNAL')),
  state text not null check (state in ('PENDING','SYNCED','CONFLICT','ERROR')),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 160),
  payload_fingerprint text not null check (length(trim(payload_fingerprint)) between 8 and 160),
  synced_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, integration_id, entity_type, local_resource_id),
  unique (workspace_id, integration_id, idempotency_key),
  foreign key (workspace_id, integration_id)
    references public.accounting_integrations(workspace_id, id) on delete cascade,
  check (external_id is null or length(trim(external_id)) between 1 and 240),
  check (external_version is null or length(external_version) <= 240),
  check (
    (state = 'SYNCED' and external_id is not null and synced_at is not null and last_error_code is null)
    or state <> 'SYNCED'
  ),
  check (
    (state = 'ERROR' and last_error_code is not null)
    or state <> 'ERROR'
  )
);

create unique index if not exists accounting_reconciliation_external_uq
  on public.accounting_reconciliation_records(workspace_id, integration_id, entity_type, external_id)
  where external_id is not null;

create index if not exists accounting_integrations_status_idx
  on public.accounting_integrations(workspace_id, status, updated_at desc);

create index if not exists accounting_reconciliation_queue_idx
  on public.accounting_reconciliation_records(workspace_id, state, updated_at desc);

create index if not exists accounting_reconciliation_entity_idx
  on public.accounting_reconciliation_records(workspace_id, entity_type, local_resource_id);

alter table public.accounting_integrations enable row level security;
alter table public.accounting_reconciliation_records enable row level security;

create policy accounting_integrations_staff_select on public.accounting_integrations
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy accounting_reconciliation_staff_select on public.accounting_reconciliation_records
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.accounting_integrations from anon, authenticated;
revoke all on table public.accounting_reconciliation_records from anon, authenticated;

grant select on table public.accounting_integrations to authenticated;
grant select on table public.accounting_reconciliation_records to authenticated;

grant all on table public.accounting_integrations to service_role;
grant all on table public.accounting_reconciliation_records to service_role;

comment on table public.accounting_integrations is
  'Provider-neutral accounting connection status. OAuth credentials are stored outside this table.';
comment on table public.accounting_reconciliation_records is
  'Stable local/external identity and version reconciliation metadata. Error details are code-only to avoid PII leakage.';
