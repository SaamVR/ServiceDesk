-- ServiceDesk AI V2 Wave 2B.2A: commercial consolidated billing schema.
-- Commercial billing reuses the authoritative V1 invoices/payment ledger; it does not create a parallel payment truth.

create table if not exists public.commercial_billing_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  period_start date not null,
  period_end date not null,
  state text not null default 'DRAFT' check (state in ('DRAFT','FINALIZED','VOID')),
  currency char(3) not null,
  charge_minor bigint not null default 0 check (charge_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  net_total_minor bigint not null default 0,
  invoice_id uuid,
  version bigint not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_id)
    references public.commercial_contracts(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete restrict,
  check (period_end >= period_start),
  check (net_total_minor = charge_minor - credit_minor)
);

create table if not exists public.commercial_billing_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null,
  source_type text not null check (source_type in ('VISIT','ADJUSTMENT')),
  visit_id uuid,
  exception_case_id uuid,
  direction text not null check (direction in ('CHARGE','CREDIT')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  state text not null default 'INCLUDED' check (state in ('INCLUDED','EXCLUDED')),
  description_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, draft_id)
    references public.commercial_billing_drafts(workspace_id, id) on delete cascade,
  foreign key (workspace_id, visit_id)
    references public.visits(workspace_id, id) on delete restrict,
  foreign key (workspace_id, exception_case_id)
    references public.commercial_exception_cases(workspace_id, id) on delete restrict,
  check (
    (source_type = 'VISIT' and visit_id is not null and exception_case_id is null and direction = 'CHARGE')
    or
    (source_type = 'ADJUSTMENT' and visit_id is null and exception_case_id is not null)
  )
);

create unique index if not exists commercial_billing_active_visit_uq
  on public.commercial_billing_lines(workspace_id, visit_id)
  where visit_id is not null and state = 'INCLUDED';

create unique index if not exists commercial_billing_active_adjustment_uq
  on public.commercial_billing_lines(workspace_id, exception_case_id)
  where exception_case_id is not null and state = 'INCLUDED';

create unique index if not exists commercial_billing_active_period_uq
  on public.commercial_billing_drafts(workspace_id, contract_version_id, period_start, period_end)
  where state in ('DRAFT','FINALIZED');

create index if not exists commercial_billing_drafts_contract_period_idx
  on public.commercial_billing_drafts(workspace_id, contract_version_id, period_start, period_end, state);

create index if not exists commercial_billing_lines_draft_idx
  on public.commercial_billing_lines(workspace_id, draft_id, state, created_at);

-- V1 invoices remain the authoritative financial document. A commercial invoice has exactly one
-- commercial billing source instead of a quote.
alter table public.invoices
  alter column quote_id drop not null;

alter table public.invoices
  add column if not exists commercial_billing_draft_id uuid;

alter table public.invoices
  drop constraint if exists invoices_business_source_ck;

alter table public.invoices
  add constraint invoices_business_source_ck
  check ((quote_id is not null) <> (commercial_billing_draft_id is not null));

alter table public.invoices
  drop constraint if exists invoices_commercial_billing_draft_fk;

alter table public.invoices
  add constraint invoices_commercial_billing_draft_fk
  foreign key (workspace_id, commercial_billing_draft_id)
  references public.commercial_billing_drafts(workspace_id, id) on delete restrict;

create unique index if not exists invoices_commercial_billing_draft_uq
  on public.invoices(workspace_id, commercial_billing_draft_id)
  where commercial_billing_draft_id is not null;

alter table public.commercial_billing_drafts
  drop constraint if exists commercial_billing_drafts_invoice_fk;

alter table public.commercial_billing_drafts
  add constraint commercial_billing_drafts_invoice_fk
  foreign key (workspace_id, invoice_id)
  references public.invoices(workspace_id, id) on delete restrict;

alter table public.commercial_billing_drafts enable row level security;
alter table public.commercial_billing_lines enable row level security;

create policy commercial_billing_drafts_staff_select on public.commercial_billing_drafts
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy commercial_billing_lines_staff_select on public.commercial_billing_lines
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.commercial_billing_drafts from anon, authenticated;
revoke all on table public.commercial_billing_lines from anon, authenticated;
grant select on table public.commercial_billing_drafts to authenticated;
grant select on table public.commercial_billing_lines to authenticated;
grant all on table public.commercial_billing_drafts to service_role;
grant all on table public.commercial_billing_lines to service_role;

comment on table public.commercial_billing_drafts is
  'Commercial consolidated billing work-in-progress. Finalization creates an authoritative invoices row but never applies payment.';
comment on table public.commercial_billing_lines is
  'Traceable commercial invoice-draft sources. Visit charges are derived from contract snapshots; adjustments remain policy-bound.';
