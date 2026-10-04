-- ServiceDesk AI V1 E05: conversation inbox and handover runtime
-- INT4B repaired for real PostgreSQL/Supabase staging proof.

alter table public.conversations
  add column if not exists provider_account_id text,
  add column if not exists handover_owner_revision bigint not null default 0 check (handover_owner_revision >= 0);

create unique index if not exists conversations_provider_thread_uq
  on public.conversations(workspace_id, channel, provider_thread_id)
  where provider_thread_id is not null;
create index if not exists conversations_last_message_idx
  on public.conversations(workspace_id, coalesce(last_message_at, created_at) desc);
create index if not exists conversations_customer_idx
  on public.conversations(workspace_id, customer_id, coalesce(last_message_at, created_at) desc)
  where customer_id is not null;

alter table public.messages
  add column if not exists provider_receipt_key text,
  add column if not exists provider_account_id text,
  add column if not exists provider_occurred_at timestamptz,
  add column if not exists sender_ref text,
  add column if not exists content_kind text check (content_kind is null or content_kind in ('TEXT','MEDIA_REFERENCE','UNSUPPORTED')),
  add column if not exists media_reference jsonb,
  add column if not exists raw_provider_event_ref text,
  add column if not exists outbound_idempotency_key text,
  add column if not exists outbox_event_id uuid,
  add column if not exists delivery_state text check (delivery_state is null or delivery_state in ('QUEUED','RUNNING','PROVIDER_ACCEPTED','DELIVERED','READ','FAILED','SUPPRESSED'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_outbox_event_fk'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_outbox_event_fk
      foreign key (workspace_id, outbox_event_id)
      references public.outbox_events(workspace_id, id)
      on delete set null (outbox_event_id);
  end if;
end $$;

create unique index if not exists messages_provider_receipt_uq
  on public.messages(workspace_id, provider_receipt_key)
  where provider_receipt_key is not null;
create unique index if not exists messages_outbound_idempotency_uq
  on public.messages(workspace_id, outbound_idempotency_key)
  where outbound_idempotency_key is not null;
create index if not exists messages_conversation_created_idx
  on public.messages(workspace_id, conversation_id, created_at asc);
create index if not exists messages_provider_lookup_idx
  on public.messages(workspace_id, provider_account_id, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.provider_inbound_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('WHATSAPP','EMAIL')),
  provider_account_id text not null,
  provider_message_id text not null,
  provider_receipt_key text not null,
  sender_ref text not null,
  provider_occurred_at timestamptz not null,
  raw_provider_event_ref text not null,
  content_kind text not null check (content_kind in ('TEXT','MEDIA_REFERENCE','UNSUPPORTED')),
  conversation_id uuid,
  message_id uuid,
  received_at timestamptz not null,
  processed_at timestamptz,
  state text not null check (state in ('RECEIVED','APPLIED','DUPLICATE','IGNORED')),
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_account_id, provider_receipt_key),
  unique (workspace_id, provider, provider_account_id, provider_message_id),
  foreign key (workspace_id, conversation_id) references public.conversations(workspace_id, id),
  foreign key (workspace_id, message_id) references public.messages(workspace_id, id)
);

alter table public.provider_inbound_receipts
  add column if not exists sender_ref text,
  add column if not exists provider_occurred_at timestamptz;

create index if not exists provider_inbound_receipts_processed_idx
  on public.provider_inbound_receipts(workspace_id, state, received_at desc);
create index if not exists provider_inbound_receipts_lookup_idx
  on public.provider_inbound_receipts(workspace_id, provider, provider_account_id, provider_receipt_key);

alter table public.provider_inbound_receipts enable row level security;

-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS. Use deterministic drop/create.
drop policy if exists provider_inbound_receipts_staff_select on public.provider_inbound_receipts;
create policy provider_inbound_receipts_staff_select
on public.provider_inbound_receipts
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists conversations_staff_all on public.conversations;
drop policy if exists messages_staff_all on public.messages;
drop policy if exists conversations_staff_select on public.conversations;
drop policy if exists messages_staff_select on public.messages;
drop policy if exists messages_customer_select on public.messages;

create policy conversations_staff_select
on public.conversations
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy messages_staff_select
on public.messages
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

-- Preserve the existing customer-read semantics while making the migration rerunnable.
drop policy if exists conversations_customer_select on public.conversations;
create policy conversations_customer_select
on public.conversations
for select to authenticated
using (
  customer_id is not null and exists (
    select 1 from public.customers c
    where c.workspace_id = conversations.workspace_id
      and c.id = conversations.customer_id
      and c.auth_user_id = auth.uid()
      and c.archived_at is null
  )
);

create policy messages_customer_select
on public.messages
for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.customers cust on cust.workspace_id = c.workspace_id and cust.id = c.customer_id
    where c.workspace_id = messages.workspace_id
      and c.id = messages.conversation_id
      and cust.auth_user_id = auth.uid()
      and cust.archived_at is null
  )
);

-- No authenticated direct insert/update/delete policies are added for conversations, messages, or provider receipts.
