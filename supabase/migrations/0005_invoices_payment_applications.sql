-- ServiceDesk AI V1 E03: invoices and authoritative verified-payment applications

create type public.invoice_status as enum ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID');
create type public.payment_application_state as enum ('APPLIED','REVIEW');
create type public.payment_purpose as enum ('DEPOSIT','BALANCE','PLATFORM_SUBSCRIPTION');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quote_id uuid not null,
  visit_id uuid,
  status public.invoice_status not null default 'ISSUED',
  currency char(3) not null,
  total_minor bigint not null check (total_minor >= 0),
  allocated_minor bigint not null default 0 check (allocated_minor >= 0),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  balance_minor bigint not null check (balance_minor >= 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, quote_id),
  check (allocated_minor >= refunded_minor),
  check ((allocated_minor - refunded_minor) + balance_minor = total_minor)
);

create table public.verified_payment_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (length(trim(provider)) > 0),
  provider_account_id text not null check (length(trim(provider_account_id)) > 0),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  provider_transaction_id text not null check (length(trim(provider_transaction_id)) > 0),
  purpose public.payment_purpose not null,
  quote_id uuid,
  hold_id uuid,
  invoice_id uuid,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  occurred_at timestamptz not null,
  state public.payment_application_state not null,
  reason_code text,
  created_at timestamptz not null default now(),
  unique (provider, provider_account_id, provider_event_id),
  unique (workspace_id, provider_account_id, provider_transaction_id, purpose),
  unique (workspace_id, id),
  foreign key (workspace_id, invoice_id) references public.invoices(workspace_id, id)
);

create index invoices_workspace_status_idx on public.invoices(workspace_id, status, updated_at desc);
create index payment_applications_workspace_state_idx on public.verified_payment_applications(workspace_id, state, created_at desc);

alter table public.invoices enable row level security;
alter table public.verified_payment_applications enable row level security;

create policy invoices_staff_read on public.invoices
  for select using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER','CREW']::public.membership_role[]));

create policy payment_applications_staff_read on public.verified_payment_applications
  for select using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

-- Authoritative writes are trusted server/service-role only. No broad anonymous mutation policy is added.
