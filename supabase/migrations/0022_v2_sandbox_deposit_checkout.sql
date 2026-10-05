-- ServiceDesk AI V2: extend internal sandbox checkout sessions to booking deposits.
-- Deposit checkout remains non-authoritative; only verified payment application may create invoice/visit truth.

alter table public.sandbox_checkout_sessions
  alter column invoice_id drop not null;

alter table public.sandbox_checkout_sessions
  add column if not exists hold_id uuid;

alter table public.sandbox_checkout_sessions
  drop constraint if exists sandbox_checkout_sessions_purpose_check;

alter table public.sandbox_checkout_sessions
  add constraint sandbox_checkout_sessions_purpose_check
  check (purpose in ('DEPOSIT','BALANCE'));

alter table public.sandbox_checkout_sessions
  add constraint sandbox_checkout_sessions_hold_fk
  foreign key (workspace_id, hold_id)
  references public.slot_holds(workspace_id, id)
  on delete restrict;

alter table public.sandbox_checkout_sessions
  add constraint sandbox_checkout_sessions_target_check
  check (
    (purpose = 'DEPOSIT' and hold_id is not null and invoice_id is null)
    or
    (purpose = 'BALANCE' and invoice_id is not null)
  );

create index if not exists sandbox_checkout_sessions_hold_idx
  on public.sandbox_checkout_sessions(workspace_id, hold_id, created_at desc)
  where hold_id is not null;

comment on column public.sandbox_checkout_sessions.hold_id is
  'Authoritative slot-hold reference required only for DEPOSIT sandbox checkout.';

comment on table public.sandbox_checkout_sessions is
  'Internal SANDBOX/DEMO checkout session state for DEPOSIT or BALANCE only. Never authoritative for paid invoice, confirmed hold or visit state.';
