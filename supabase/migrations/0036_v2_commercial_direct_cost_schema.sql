-- ServiceDesk AI V2 Wave 2B.4A: commercial direct-cost provenance.
-- Costs are append-only financial inputs for profitability reporting. No tax treatment is inferred here.

create table if not exists public.commercial_direct_cost_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visit_id uuid not null,
  contract_version_id uuid not null,
  site_id uuid not null,
  service_id uuid not null,
  category text not null check (category in ('LABOR','SUPPLIES','TRAVEL')),
  basis text not null check (basis in ('ESTIMATED','ACTUAL')),
  direction text not null check (direction in ('COST','REVERSAL')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  source_kind text not null check (source_kind in ('MANUAL','CREW_RATE','SUPPLY','TRAVEL')),
  source_reference text check (source_reference is null or length(source_reference) between 1 and 160),
  reverses_entry_id uuid,
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 160),
  created_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, visit_id)
    references public.visits(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete restrict,
  foreign key (workspace_id, site_id)
    references public.commercial_sites(workspace_id, id) on delete restrict,
  foreign key (workspace_id, service_id)
    references public.service_catalog(workspace_id, id) on delete restrict,
  foreign key (workspace_id, reverses_entry_id)
    references public.commercial_direct_cost_entries(workspace_id, id) on delete restrict,
  check (
    (direction = 'COST' and reverses_entry_id is null)
    or (direction = 'REVERSAL' and reverses_entry_id is not null)
  )
);

create index if not exists commercial_direct_cost_visit_idx
  on public.commercial_direct_cost_entries(workspace_id, visit_id, occurred_at desc);

create index if not exists commercial_direct_cost_site_idx
  on public.commercial_direct_cost_entries(workspace_id, site_id, service_id, category, basis);

alter table public.commercial_direct_cost_entries enable row level security;

create policy commercial_direct_cost_staff_select on public.commercial_direct_cost_entries
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.commercial_direct_cost_entries from anon, authenticated;
grant select on table public.commercial_direct_cost_entries to authenticated;
grant all on table public.commercial_direct_cost_entries to service_role;

comment on table public.commercial_direct_cost_entries is
  'Append-only commercial direct costs and reversals with explicit estimate/actual basis and source provenance. No tax certification is implied.';
