-- ServiceDesk AI V1 INT8 / E08: authoritative manual payment + quality core
-- Financial truth remains invoice + ledger truth. No provider/Stripe call is made here.

create table if not exists public.manual_payment_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null,
  ledger_entry_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  method text not null check (method in ('CASH','BANK_TRANSFER','OTHER')),
  reference text not null check (length(trim(reference)) between 1 and 160),
  occurred_at timestamptz not null,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  unique (workspace_id, ledger_entry_id),
  foreign key (workspace_id, invoice_id) references public.invoices(workspace_id, id) on delete restrict,
  foreign key (workspace_id, ledger_entry_id) references public.ledger_entries(workspace_id, id) on delete restrict
);

create table if not exists public.quality_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visit_id uuid not null,
  attention_item_id uuid,
  state text not null default 'OPEN' check (state in ('OPEN','IN_REVIEW','RESOLVED')),
  feedback_score integer check (feedback_score between 1 and 5),
  summary text not null check (length(trim(summary)) between 1 and 500),
  owner_user_id uuid references auth.users(id),
  due_at timestamptz,
  resolution_note text,
  review_request_state text not null default 'NOT_ELIGIBLE' check (review_request_state in ('NOT_ELIGIBLE','ELIGIBLE','REQUESTED')),
  idempotency_key text check (idempotency_key is null or length(trim(idempotency_key)) > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, visit_id) references public.visits(workspace_id, id) on delete cascade,
  foreign key (workspace_id, attention_item_id) references public.attention_items(workspace_id, id) on delete set null
);

create index if not exists manual_payment_records_invoice_idx
  on public.manual_payment_records(workspace_id, invoice_id, created_at desc);
create index if not exists quality_cases_state_idx
  on public.quality_cases(workspace_id, state, updated_at desc);
create index if not exists quality_cases_owner_due_idx
  on public.quality_cases(workspace_id, owner_user_id, due_at)
  where state <> 'RESOLVED';
create unique index if not exists quality_cases_one_open_per_visit_idx
  on public.quality_cases(workspace_id, visit_id)
  where state in ('OPEN','IN_REVIEW');

alter table public.manual_payment_records enable row level security;
alter table public.quality_cases enable row level security;

drop policy if exists manual_payment_records_staff_select on public.manual_payment_records;
create policy manual_payment_records_staff_select on public.manual_payment_records
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists quality_cases_staff_select on public.quality_cases;
create policy quality_cases_staff_select on public.quality_cases
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists ledger_staff_insert on public.ledger_entries;
drop policy if exists outbox_staff_insert on public.outbox_events;
drop policy if exists attention_staff_all on public.attention_items;
drop policy if exists attention_staff_select on public.attention_items;
create policy attention_staff_select on public.attention_items
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create or replace function public.servicedesk_invoice_json(p_invoice public.invoices)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_invoice.id is null then null else jsonb_build_object(
    'id', p_invoice.id,
    'workspaceId', p_invoice.workspace_id,
    'visitId', p_invoice.visit_id,
    'status', p_invoice.status::text,
    'currency', p_invoice.currency,
    'totalMinor', p_invoice.total_minor,
    'allocatedMinor', p_invoice.allocated_minor,
    'refundedMinor', p_invoice.refunded_minor,
    'balanceMinor', p_invoice.balance_minor
  ) end;
$$;

create or replace function public.servicedesk_quality_case_json(p_case public.quality_cases)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_case.id is null then null else jsonb_build_object(
    'id', p_case.id,
    'workspaceId', p_case.workspace_id,
    'visitId', p_case.visit_id,
    'state', p_case.state,
    'feedbackScore', p_case.feedback_score,
    'summary', p_case.summary,
    'ownerUserId', p_case.owner_user_id,
    'dueAt', p_case.due_at,
    'resolutionNote', p_case.resolution_note,
    'reviewRequestState', p_case.review_request_state,
    'version', p_case.version,
    'createdAt', p_case.created_at,
    'updatedAt', p_case.updated_at
  ) end;
$$;

create or replace function public.servicedesk_attention_item_json(p_item public.attention_items)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_item.id is null then null else jsonb_build_object(
    'id', p_item.id,
    'workspaceId', p_item.workspace_id,
    'type', p_item.type,
    'severity', p_item.severity::text,
    'status', p_item.status::text,
    'resourceType', p_item.resource_type,
    'resourceId', p_item.resource_id,
    'ownerUserId', p_item.owner_user_id,
    'dueAt', p_item.due_at,
    'summary', p_item.summary
  ) end;
$$;

create or replace function public.servicedesk_apply_manual_payment(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_invoice_id uuid := (p_input->>'invoiceId')::uuid;
  v_amount bigint := (p_input->>'amountMinor')::bigint;
  v_currency char(3) := upper(p_input->>'currency');
  v_method text := p_input->>'method';
  v_reference text := nullif(trim(p_input->>'reference'), '');
  v_occurred_at timestamptz := (p_input->>'occurredAt')::timestamptz;
  v_idempotency_key text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_invoice public.invoices%rowtype;
  v_existing public.manual_payment_records%rowtype;
  v_ledger public.ledger_entries%rowtype;
  v_outbox_id uuid;
begin
  if v_workspace is null or v_actor_user is null or v_invoice_id is null or v_amount is null
     or v_currency is null or v_method is null or v_reference is null or v_occurred_at is null
     or v_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'MANUAL_PAYMENT_INVALID');
  end if;

  if not (v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships
    where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  )) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_existing
  from public.manual_payment_records
  where workspace_id = v_workspace and idempotency_key = v_idempotency_key
  limit 1;
  if found then
    select * into v_invoice from public.invoices where workspace_id = v_workspace and id = v_existing.invoice_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'recordId', v_existing.id, 'invoice', public.servicedesk_invoice_json(v_invoice));
  end if;

  if v_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'MANUAL_PAYMENT_AMOUNT_INVALID'); end if;
  if length(v_currency) <> 3 then return jsonb_build_object('ok', false, 'code', 'MANUAL_PAYMENT_CURRENCY_INVALID'); end if;
  if v_method not in ('CASH','BANK_TRANSFER','OTHER') then return jsonb_build_object('ok', false, 'code', 'MANUAL_PAYMENT_METHOD_INVALID'); end if;
  if length(v_reference) > 160 then return jsonb_build_object('ok', false, 'code', 'MANUAL_PAYMENT_REFERENCE_INVALID'); end if;

  select * into v_invoice from public.invoices where workspace_id = v_workspace and id = v_invoice_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'INVOICE_NOT_FOUND'); end if;
  if v_invoice.status in ('VOID','PAID') then return jsonb_build_object('ok', false, 'code', 'INVOICE_NOT_PAYABLE'); end if;
  if v_currency <> v_invoice.currency then return jsonb_build_object('ok', false, 'code', 'CURRENCY_MISMATCH'); end if;
  if v_amount > v_invoice.balance_minor then return jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_BALANCE'); end if;

  insert into public.ledger_entries(id, workspace_id, resource_type, resource_id, direction, amount_minor, currency, idempotency_key, occurred_at)
  values (gen_random_uuid(), v_workspace, 'invoice', v_invoice.id, 'CREDIT', v_amount, v_currency, 'manual-payment-ledger:' || v_idempotency_key, v_occurred_at)
  returning * into v_ledger;

  insert into public.manual_payment_records(
    id, workspace_id, invoice_id, ledger_entry_id, actor_user_id, amount_minor, currency, method, reference, occurred_at, idempotency_key, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_invoice.id, v_ledger.id, v_actor_user, v_amount, v_currency, v_method, v_reference, v_occurred_at, v_idempotency_key, v_now
  ) returning * into v_existing;

  update public.invoices
  set allocated_minor = allocated_minor + v_amount,
      balance_minor = balance_minor - v_amount,
      status = case when balance_minor - v_amount = 0 then 'PAID'::public.invoice_status else 'PARTIALLY_PAID'::public.invoice_status end,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_invoice.id
  returning * into v_invoice;

  insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
  values (
    gen_random_uuid(), v_workspace, 'invoice.manual_payment_recorded',
    jsonb_build_object('invoiceId', v_invoice.id, 'manualPaymentRecordId', v_existing.id, 'ledgerEntryId', v_ledger.id),
    'PENDING', 0, 'manual-payment-outbox:' || v_idempotency_key, v_now, v_now
  ) returning id into v_outbox_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'recordId', v_existing.id, 'ledgerEntryId', v_ledger.id, 'outboxEventId', v_outbox_id, 'invoice', public.servicedesk_invoice_json(v_invoice));
end;
$$;

create or replace function public.servicedesk_open_quality_case(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_visit_id uuid := (p_input->>'visitId')::uuid;
  v_summary text := nullif(trim(p_input->>'summary'), '');
  v_feedback_score integer := nullif(p_input->>'feedbackScore','')::integer;
  v_owner_user uuid := nullif(p_input->>'ownerUserId','')::uuid;
  v_due_at timestamptz := nullif(p_input->>'dueAt','')::timestamptz;
  v_idempotency_key text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_visit public.visits%rowtype;
  v_existing public.quality_cases%rowtype;
  v_case public.quality_cases%rowtype;
  v_attention public.attention_items%rowtype;
begin
  if v_workspace is null or v_visit_id is null or v_summary is null or v_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'QUALITY_CASE_INVALID');
  end if;
  if length(v_summary) > 500 then return jsonb_build_object('ok', false, 'code', 'QUALITY_SUMMARY_TOO_LONG'); end if;
  if v_feedback_score is not null and (v_feedback_score < 1 or v_feedback_score > 5) then
    return jsonb_build_object('ok', false, 'code', 'QUALITY_FEEDBACK_SCORE_INVALID');
  end if;
  if v_owner_user is not null and not exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_owner_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  ) then
    return jsonb_build_object('ok', false, 'code', 'QUALITY_OWNER_INVALID');
  end if;

  select * into v_existing from public.quality_cases where workspace_id = v_workspace and idempotency_key = v_idempotency_key limit 1;
  if found then
    select * into v_attention from public.attention_items where workspace_id = v_workspace and id = v_existing.attention_item_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'qualityCase', public.servicedesk_quality_case_json(v_existing), 'attentionItem', public.servicedesk_attention_item_json(v_attention));
  end if;

  select * into v_visit from public.visits where workspace_id = v_workspace and id = v_visit_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND'); end if;

  insert into public.quality_cases(
    id, workspace_id, visit_id, state, feedback_score, summary, owner_user_id, due_at, review_request_state, idempotency_key, version, created_at, updated_at
  ) values (
    gen_random_uuid(), v_workspace, v_visit.id, 'OPEN', v_feedback_score, v_summary, v_owner_user, v_due_at,
    case when v_feedback_score is not null and v_feedback_score <= 2 then 'NOT_ELIGIBLE' else 'NOT_ELIGIBLE' end,
    v_idempotency_key, 1, v_now, v_now
  ) returning * into v_case;

  insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, owner_user_id, due_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_workspace, 'QUALITY', 'quality_case', v_case.id,
    case when coalesce(v_feedback_score, 5) <= 2 then 'WARNING'::public.attention_severity else 'INFO'::public.attention_severity end,
    'OPEN', v_summary, v_owner_user, v_due_at, v_now, v_now
  )
  returning * into v_attention;

  update public.quality_cases
  set attention_item_id = v_attention.id, updated_at = v_now
  where workspace_id = v_workspace and id = v_case.id
  returning * into v_case;

  return jsonb_build_object('ok', true, 'duplicate', false, 'qualityCase', public.servicedesk_quality_case_json(v_case), 'attentionItem', public.servicedesk_attention_item_json(v_attention));
end;
$$;

create or replace function public.servicedesk_apply_quality_case_action(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_case_id uuid := (p_input->>'qualityCaseId')::uuid;
  v_action text := p_input->>'action';
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_owner_user uuid := nullif(p_input->>'ownerUserId','')::uuid;
  v_resolution_note text := nullif(trim(p_input->>'resolutionNote'), '');
  v_idempotency_key text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_case public.quality_cases%rowtype;
  v_attention public.attention_items%rowtype;
  v_outbox_id uuid;
begin
  if v_workspace is null or v_actor_user is null or v_case_id is null or v_action is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'QUALITY_ACTION_INVALID');
  end if;
  if not (v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  )) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_case from public.quality_cases where workspace_id = v_workspace and id = v_case_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUALITY_CASE_NOT_FOUND'); end if;
  if v_case.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;

  if v_action = 'START_REVIEW' then
    if v_case.state <> 'OPEN' then return jsonb_build_object('ok', false, 'code', 'QUALITY_STATE_INVALID'); end if;
    update public.quality_cases set state = 'IN_REVIEW', version = version + 1, updated_at = v_now
    where workspace_id = v_workspace and id = v_case.id returning * into v_case;
  elsif v_action = 'ASSIGN' then
    if v_owner_user is null then return jsonb_build_object('ok', false, 'code', 'QUALITY_OWNER_REQUIRED'); end if;
    if not exists (select 1 from public.memberships where workspace_id = v_workspace and user_id = v_owner_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')) then
      return jsonb_build_object('ok', false, 'code', 'QUALITY_OWNER_INVALID');
    end if;
    if v_case.state = 'RESOLVED' then return jsonb_build_object('ok', false, 'code', 'QUALITY_STATE_INVALID'); end if;
    update public.quality_cases set owner_user_id = v_owner_user, version = version + 1, updated_at = v_now
    where workspace_id = v_workspace and id = v_case.id returning * into v_case;
    update public.attention_items set owner_user_id = v_owner_user, updated_at = v_now
    where workspace_id = v_workspace and id = v_case.attention_item_id and status = 'OPEN'
    returning * into v_attention;
  elsif v_action = 'RESOLVE' then
    if v_case.state not in ('OPEN','IN_REVIEW') then return jsonb_build_object('ok', false, 'code', 'QUALITY_STATE_INVALID'); end if;
    if v_resolution_note is null then return jsonb_build_object('ok', false, 'code', 'QUALITY_RESOLUTION_NOTE_REQUIRED'); end if;
    update public.quality_cases
    set state = 'RESOLVED', resolution_note = v_resolution_note, review_request_state = 'ELIGIBLE', version = version + 1, updated_at = v_now
    where workspace_id = v_workspace and id = v_case.id returning * into v_case;
    update public.attention_items
    set status = 'RESOLVED', updated_at = v_now
    where workspace_id = v_workspace and id = v_case.attention_item_id and status = 'OPEN'
    returning * into v_attention;
  elsif v_action = 'REQUEST_REVIEW' then
    if v_case.state <> 'RESOLVED' or v_case.review_request_state <> 'ELIGIBLE' then
      return jsonb_build_object('ok', false, 'code', 'QUALITY_REVIEW_REQUEST_INVALID');
    end if;
    update public.quality_cases set review_request_state = 'REQUESTED', version = version + 1, updated_at = v_now
    where workspace_id = v_workspace and id = v_case.id returning * into v_case;
    insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
    values (
      gen_random_uuid(), v_workspace, 'quality.review_request',
      jsonb_build_object('qualityCaseId', v_case.id, 'visitId', v_case.visit_id),
      'PENDING', 0, coalesce('quality-review:' || v_case.id::text || ':' || v_idempotency_key, 'quality-review:' || v_case.id::text), v_now, v_now
    ) on conflict (workspace_id, idempotency_key) do nothing
    returning id into v_outbox_id;
  else
    return jsonb_build_object('ok', false, 'code', 'QUALITY_ACTION_UNSUPPORTED');
  end if;

  if v_attention.id is null then
    select * into v_attention from public.attention_items where workspace_id = v_workspace and id = v_case.attention_item_id;
  end if;

  return jsonb_build_object('ok', true, 'qualityCase', public.servicedesk_quality_case_json(v_case), 'attentionItem', public.servicedesk_attention_item_json(v_attention), 'outboxEventId', v_outbox_id);
end;
$$;

create or replace function public.servicedesk_read_workspace_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_customer_filter uuid := nullif(p_input->>'customerId','')::uuid;
  v_request_filter uuid := nullif(p_input->>'requestId','')::uuid;
  v_visit_filter uuid := nullif(p_input->>'visitId','')::uuid;
  v_invoice_filter uuid := nullif(p_input->>'invoiceId','')::uuid;
  v_conversation_filter uuid := nullif(p_input->>'conversationId','')::uuid;
  v_staff boolean;
  v_customer_id uuid;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'SNAPSHOT_INVALID');
  end if;

  v_staff := v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  );

  if not v_staff then
    select id into v_customer_id from public.customers where workspace_id = v_workspace and auth_user_id = v_actor_user and archived_at is null;
    if v_actor_role <> 'CUSTOMER' or v_customer_id is null then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
    if v_customer_filter is not null and v_customer_filter <> v_customer_id then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
    v_customer_filter := v_customer_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'workspaceId', r.workspace_id, 'customerId', r.customer_id, 'propertyId', r.property_id,
      'serviceCode', sc.code, 'status', r.status::text, 'bedrooms', r.bedrooms, 'bathrooms', r.bathrooms,
      'requestedStartAt', r.requested_start_at, 'version', r.version, 'createdAt', r.created_at, 'updatedAt', r.updated_at
    ) order by r.created_at desc)
      from public.requests r left join public.service_catalog sc on sc.workspace_id = r.workspace_id and sc.id = r.service_id
      where r.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_request_filter is null or r.id = v_request_filter)
    ), '[]'::jsonb),
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'workspaceId', q.workspace_id, 'requestId', q.request_id, 'version', q.version, 'status', q.status::text,
      'currency', q.currency, 'subtotalMinor', q.subtotal_minor, 'taxMinor', q.tax_minor, 'totalMinor', q.total_minor,
      'depositMinor', q.deposit_minor, 'balanceMinor', q.balance_minor, 'durationMinutes', q.duration_minutes,
      'bufferMinutes', q.buffer_minutes, 'rateVersion', q.rate_version, 'validUntil', q.valid_until
    ) order by q.created_at desc)
      from public.quotes q join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id
      where q.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_request_filter is null or q.request_id = v_request_filter)
    ), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'workspaceId', v.workspace_id, 'requestId', v.request_id, 'quoteId', v.quote_id, 'crewId', v.crew_id,
      'status', case v.status when 'SCHEDULED' then 'CONFIRMED' when 'NEEDS_REVIEW' then 'PENDING_REVIEW' else v.status::text end,
      'startAt', v.starts_at, 'serviceMinutes', coalesce(q.duration_minutes, greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int)),
      'bufferMinutes', coalesce(q.buffer_minutes, 0), 'version', v.version
    ) order by v.starts_at desc)
      from public.visits v left join public.quotes q on q.workspace_id = v.workspace_id and q.id = v.quote_id
      join public.requests r on r.workspace_id = v.workspace_id and r.id = v.request_id
      where v.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_visit_filter is null or v.id = v_visit_filter)
    ), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(public.servicedesk_invoice_json(i) order by i.created_at desc)
      from public.invoices i join public.quotes q on q.workspace_id = i.workspace_id and q.id = i.quote_id join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id
      where i.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_invoice_filter is null or i.id = v_invoice_filter)
    ), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'workspaceId', c.workspace_id, 'requestId', c.request_id, 'customerId', c.customer_id,
      'channel', c.channel, 'assignedUserId', c.assigned_user_id, 'handoverActive', c.handover_active,
      'version', c.version, 'lastMessageAt', c.last_message_at
    ) order by c.updated_at desc)
      from public.conversations c
      where c.workspace_id = v_workspace and (v_customer_filter is null or c.customer_id = v_customer_filter) and (v_conversation_filter is null or c.id = v_conversation_filter)
    ), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'workspaceId', m.workspace_id, 'conversationId', m.conversation_id, 'direction', m.direction,
      'senderKind', m.sender_kind, 'providerMessageId', m.provider_message_id, 'body', m.body,
      'mediaReference', m.media_reference, 'deliveryState', m.delivery_state, 'createdAt', m.created_at
    ) order by m.created_at asc)
      from public.messages m join public.conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id
      where m.workspace_id = v_workspace and (v_customer_filter is null or c.customer_id = v_customer_filter) and (v_conversation_filter is null or m.conversation_id = v_conversation_filter)
    ), '[]'::jsonb),
    'recurrenceRules', coalesce((select jsonb_agg(public.servicedesk_recurrence_rule_json(rr) order by rr.created_at desc)
      from public.recurrence_rules rr join public.requests r on r.workspace_id = rr.workspace_id and r.id = rr.request_id
      where rr.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_request_filter is null or rr.request_id = v_request_filter)
    ), '[]'::jsonb),
    'visitEvidence', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ve.id, 'workspaceId', ve.workspace_id, 'visitId', ve.visit_id, 'kind', ve.kind,
      'mediaReference', ve.media_reference, 'text', ve.text, 'capturedAt', ve.captured_at,
      'submittedByUserId', ve.submitted_by_user_id, 'createdAt', ve.created_at
    ) order by ve.created_at desc)
      from public.visit_evidence ve join public.visits v on v.workspace_id = ve.workspace_id and v.id = ve.visit_id join public.requests r on r.workspace_id = v.workspace_id and r.id = v.request_id
      where ve.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_visit_filter is null or ve.visit_id = v_visit_filter)
    ), '[]'::jsonb),
    'visitChecklistItems', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ci.id, 'workspaceId', ci.workspace_id, 'visitId', ci.visit_id, 'itemKey', ci.item_key,
      'completed', ci.completed, 'note', ci.note, 'updatedByUserId', ci.updated_by_user_id,
      'updatedAt', ci.updated_at, 'version', ci.version
    ) order by ci.item_key asc)
      from public.visit_checklist_items ci join public.visits v on v.workspace_id = ci.workspace_id and v.id = ci.visit_id join public.requests r on r.workspace_id = v.workspace_id and r.id = v.request_id
      where ci.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter) and (v_visit_filter is null or ci.visit_id = v_visit_filter)
    ), '[]'::jsonb),
    'attentionItems', case when v_staff then coalesce((select jsonb_agg(public.servicedesk_attention_item_json(ai) order by ai.created_at desc)
      from public.attention_items ai where ai.workspace_id = v_workspace), '[]'::jsonb) else '[]'::jsonb end,
    'qualityCases', case when v_staff then coalesce((select jsonb_agg(public.servicedesk_quality_case_json(qc) order by qc.updated_at desc)
      from public.quality_cases qc where qc.workspace_id = v_workspace and (v_visit_filter is null or qc.visit_id = v_visit_filter)), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke execute on function public.servicedesk_apply_manual_payment(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_open_quality_case(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_apply_quality_case_action(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_read_workspace_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_apply_manual_payment(jsonb) to service_role;
grant execute on function public.servicedesk_open_quality_case(jsonb) to service_role;
grant execute on function public.servicedesk_apply_quality_case_action(jsonb) to service_role;
grant execute on function public.servicedesk_read_workspace_snapshot(jsonb) to service_role;
