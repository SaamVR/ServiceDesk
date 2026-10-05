-- ServiceDesk AI V2: internal sandbox checkout session boundary
-- Stores non-authoritative demo checkout state only. Invoice/payment truth remains owned by verified payment application.

create table if not exists public.sandbox_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  quote_id uuid not null,
  invoice_id uuid not null,
  purpose text not null check (purpose = 'BALANCE'),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'OPEN' check (status in ('OPEN','APPLIED','DUPLICATE','PAYMENT_REVIEW','EXPIRED','CANCELLED')),
  provider_event_id text,
  provider_transaction_id text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete cascade,
  foreign key (workspace_id, quote_id)
    references public.quotes(workspace_id, id) on delete restrict,
  foreign key (workspace_id, invoice_id)
    references public.invoices(workspace_id, id) on delete restrict
);

create index if not exists sandbox_checkout_sessions_customer_idx
  on public.sandbox_checkout_sessions(workspace_id, customer_id, created_at desc);

create index if not exists sandbox_checkout_sessions_invoice_idx
  on public.sandbox_checkout_sessions(workspace_id, invoice_id, created_at desc);

alter table public.sandbox_checkout_sessions enable row level security;

-- Session state is server-owned. Customer authorization is resolved in the authenticated server action
-- before the service-role client reads or mutates this table.
revoke all on table public.sandbox_checkout_sessions from public;
revoke all on table public.sandbox_checkout_sessions from anon;
revoke all on table public.sandbox_checkout_sessions from authenticated;
grant select, insert, update, delete on table public.sandbox_checkout_sessions to service_role;

comment on table public.sandbox_checkout_sessions is
  'Internal SANDBOX/DEMO checkout session state only. Never authoritative for paid invoice or visit state.';
