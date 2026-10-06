-- ServiceDesk AI V2 Wave 2C.4: durable lead attribution and referral truth.
-- Attribution is event-based. First/last touch are frozen when an invoice first becomes PAID,
-- so later marketing touches cannot rewrite historical conversion attribution.

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (
    length(trim(code)) between 3 and 40
    and code = upper(code)
    and code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
  ),
  label text not null check (length(trim(label)) between 1 and 120),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.lead_attribution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_kind text not null check (event_kind in ('TOUCH','PAID_JOB')),
  customer_id uuid,
  request_id uuid,
  visit_id uuid,
  invoice_id uuid,
  source_type text check (
    source_type is null
    or source_type in ('DIRECT','REFERRAL','CAMPAIGN','ORGANIC','PAID','PARTNER','OTHER')
  ),
  source_key text check (
    source_key is null
    or (
      length(trim(source_key)) between 1 and 120
      and source_key !~ E'[\\r\\n]'
    )
  ),
  referral_code_id uuid,
  first_touch_event_id uuid,
  last_touch_event_id uuid,
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 200),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete set null,
  foreign key (workspace_id, request_id)
    references public.requests(workspace_id, id) on delete set null,
  foreign key (workspace_id, visit_id)
    references public.visits(workspace_id, id) on delete set null,
  foreign key (workspace_id, invoice_id)
    references public.invoices(workspace_id, id) on delete set null,
  foreign key (workspace_id, referral_code_id)
    references public.referral_codes(workspace_id, id) on delete set null,
  foreign key (workspace_id, first_touch_event_id)
    references public.lead_attribution_events(workspace_id, id) on delete set null,
  foreign key (workspace_id, last_touch_event_id)
    references public.lead_attribution_events(workspace_id, id) on delete set null,
  check (
    (event_kind = 'TOUCH' and request_id is not null and source_type is not null
      and invoice_id is null and first_touch_event_id is null and last_touch_event_id is null)
    or
    (event_kind = 'PAID_JOB' and request_id is not null and invoice_id is not null
      and source_type is null and source_key is null)
  ),
  check (
    referral_code_id is null
    or (event_kind = 'TOUCH' and source_type = 'REFERRAL')
  )
);

create index if not exists attribution_request_time_idx
  on public.lead_attribution_events(workspace_id, request_id, occurred_at, created_at)
  where event_kind = 'TOUCH';
create index if not exists attribution_paid_job_idx
  on public.lead_attribution_events(workspace_id, occurred_at desc)
  where event_kind = 'PAID_JOB';
create index if not exists referral_codes_active_idx
  on public.referral_codes(workspace_id, active, code);

alter table public.referral_codes enable row level security;
alter table public.lead_attribution_events enable row level security;

revoke all on table public.referral_codes from public, anon, authenticated;
revoke all on table public.lead_attribution_events from public, anon, authenticated;
grant select on table public.referral_codes to authenticated;
grant select on table public.lead_attribution_events to authenticated;
grant select, insert, update, delete on table public.referral_codes to service_role;
grant select, insert, update, delete on table public.lead_attribution_events to service_role;

drop policy if exists referral_codes_staff_select on public.referral_codes;
create policy referral_codes_staff_select
on public.referral_codes
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists attribution_events_staff_select on public.lead_attribution_events;
create policy attribution_events_staff_select
on public.lead_attribution_events
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create or replace function public.servicedesk_upsert_referral_code(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_code text := upper(trim(p_input->>'code'));
  v_label text := trim(p_input->>'label');
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_starts timestamptz := nullif(p_input->>'startsAt','')::timestamptz;
  v_ends timestamptz := nullif(p_input->>'endsAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.referral_codes%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_code is null or v_label is null
  then
    return jsonb_build_object('ok', false, 'code', 'REFERRAL_CODE_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.referral_codes(
    workspace_id, code, label, active, starts_at, ends_at, created_by, created_at, updated_at
  ) values (
    v_workspace, v_code, v_label, v_active, v_starts, v_ends, v_actor_user, v_now, v_now
  )
  on conflict (workspace_id, code) do update
  set label = excluded.label,
      active = excluded.active,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_at = v_now
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'referralCodeId', v_row.id,
    'code', v_row.code,
    'active', v_row.active
  );
exception when check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'REFERRAL_CODE_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_record_attribution_touch(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_request uuid := nullif(p_input->>'requestId','')::uuid;
  v_customer uuid := nullif(p_input->>'customerId','')::uuid;
  v_source_type text := upper(trim(p_input->>'sourceType'));
  v_source_key text := nullif(trim(p_input->>'sourceKey'),'');
  v_referral_code text := nullif(upper(trim(p_input->>'referralCode')),'');
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'),'');
  v_occurred timestamptz := coalesce(nullif(p_input->>'occurredAt','')::timestamptz, now());
  v_request_customer uuid;
  v_referral public.referral_codes%rowtype;
  v_existing public.lead_attribution_events%rowtype;
  v_event public.lead_attribution_events%rowtype;
begin
  if v_workspace is null or v_request is null or v_idempotency is null
     or v_source_type not in ('DIRECT','REFERRAL','CAMPAIGN','ORGANIC','PAID','PARTNER','OTHER')
  then
    return jsonb_build_object('ok', false, 'code', 'ATTRIBUTION_TOUCH_INPUT_INVALID');
  end if;

  select customer_id into v_request_customer
  from public.requests
  where workspace_id = v_workspace and id = v_request;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND');
  end if;

  if v_customer is not null and v_request_customer is not null and v_customer <> v_request_customer then
    return jsonb_build_object('ok', false, 'code', 'ATTRIBUTION_CUSTOMER_MISMATCH');
  end if;
  v_customer := coalesce(v_request_customer, v_customer);

  if v_source_type = 'REFERRAL' then
    if v_referral_code is null then
      return jsonb_build_object('ok', false, 'code', 'REFERRAL_CODE_REQUIRED');
    end if;
    select * into v_referral
    from public.referral_codes
    where workspace_id = v_workspace
      and code = v_referral_code
      and active
      and (starts_at is null or starts_at <= v_occurred)
      and (ends_at is null or ends_at > v_occurred);
    if not found then
      return jsonb_build_object('ok', false, 'code', 'REFERRAL_CODE_INACTIVE');
    end if;
    v_source_key := v_referral.code;
  elsif v_referral_code is not null then
    return jsonb_build_object('ok', false, 'code', 'REFERRAL_SOURCE_MISMATCH');
  end if;

  select * into v_existing
  from public.lead_attribution_events
  where workspace_id = v_workspace and idempotency_key = v_idempotency;

  if found then
    if v_existing.event_kind <> 'TOUCH'
       or v_existing.request_id <> v_request
       or v_existing.source_type <> v_source_type
       or coalesce(v_existing.source_key,'') <> coalesce(v_source_key,'')
    then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id);
  end if;

  insert into public.lead_attribution_events(
    workspace_id, event_kind, customer_id, request_id, source_type, source_key,
    referral_code_id, idempotency_key, occurred_at
  ) values (
    v_workspace, 'TOUCH', v_customer, v_request, v_source_type, v_source_key,
    v_referral.id, v_idempotency, v_occurred
  )
  returning * into v_event;

  return jsonb_build_object('ok', true, 'duplicate', false, 'eventId', v_event.id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'ATTRIBUTION_TOUCH_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_capture_paid_job_attribution()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request uuid;
  v_customer uuid;
  v_visit uuid;
  v_first uuid;
  v_last uuid;
  v_paid_at timestamptz := coalesce(new.updated_at, now());
begin
  if new.status <> 'PAID' or old.status = 'PAID' then
    return new;
  end if;

  select q.request_id, r.customer_id
  into v_request, v_customer
  from public.quotes q
  join public.requests r
    on r.workspace_id = q.workspace_id and r.id = q.request_id
  where q.workspace_id = new.workspace_id and q.id = new.quote_id;

  if v_request is null then
    return new;
  end if;

  v_visit := new.visit_id;

  select e.id into v_first
  from public.lead_attribution_events e
  where e.workspace_id = new.workspace_id
    and e.event_kind = 'TOUCH'
    and e.request_id = v_request
    and e.occurred_at <= v_paid_at
  order by e.occurred_at asc, e.created_at asc, e.id asc
  limit 1;

  select e.id into v_last
  from public.lead_attribution_events e
  where e.workspace_id = new.workspace_id
    and e.event_kind = 'TOUCH'
    and e.request_id = v_request
    and e.occurred_at <= v_paid_at
  order by e.occurred_at desc, e.created_at desc, e.id desc
  limit 1;

  insert into public.lead_attribution_events(
    workspace_id, event_kind, customer_id, request_id, visit_id, invoice_id,
    first_touch_event_id, last_touch_event_id, idempotency_key, occurred_at
  ) values (
    new.workspace_id, 'PAID_JOB', v_customer, v_request, v_visit, new.id,
    v_first, v_last, 'paid-job:' || new.id::text, v_paid_at
  )
  on conflict (workspace_id, idempotency_key) do nothing;

  return new;
end;
$$;

drop trigger if exists servicedesk_invoice_paid_attribution on public.invoices;
create trigger servicedesk_invoice_paid_attribution
after update of status on public.invoices
for each row execute function public.servicedesk_capture_paid_job_attribution();

create or replace function public.servicedesk_read_referral_attribution_summary(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_from timestamptz := nullif(p_input->>'from','')::timestamptz;
  v_to timestamptz := nullif(p_input->>'to','')::timestamptz;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role not in ('OWNER','DISPATCHER')
     or v_from is null or v_to is null or v_to <= v_from
  then
    return jsonb_build_object('ok', false, 'code', 'ATTRIBUTION_READ_INPUT_INVALID');
  end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'from', v_from,
    'to', v_to,
    'rows', coalesce((
      select jsonb_agg(row_json order by row_json->>'code')
      from (
        select jsonb_build_object(
          'referralCodeId', rc.id,
          'code', rc.code,
          'label', rc.label,
          'active', rc.active,
          'touchCount', count(distinct t.id),
          'paidJobCount', count(distinct p.id),
          'firstTouchAt', min(t.occurred_at),
          'lastTouchAt', max(t.occurred_at)
        ) as row_json
        from public.referral_codes rc
        left join public.lead_attribution_events t
          on t.workspace_id = rc.workspace_id
         and t.referral_code_id = rc.id
         and t.event_kind = 'TOUCH'
         and t.occurred_at >= v_from
         and t.occurred_at < v_to
        left join public.lead_attribution_events p
          on p.workspace_id = rc.workspace_id
         and p.event_kind = 'PAID_JOB'
         and p.occurred_at >= v_from
         and p.occurred_at < v_to
         and (
           p.first_touch_event_id in (
             select x.id from public.lead_attribution_events x
             where x.workspace_id = rc.workspace_id and x.referral_code_id = rc.id
           )
           or p.last_touch_event_id in (
             select x.id from public.lead_attribution_events x
             where x.workspace_id = rc.workspace_id and x.referral_code_id = rc.id
           )
         )
        where rc.workspace_id = v_workspace
        group by rc.id, rc.code, rc.label, rc.active
      ) rows
    ), '[]'::jsonb),
    'disclosure', 'Attribution is directional, not perfect. First and last touch are frozen when the invoice first becomes PAID.'
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'ATTRIBUTION_READ_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_upsert_referral_code(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_record_attribution_touch(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_read_referral_attribution_summary(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_upsert_referral_code(jsonb) to service_role;
grant execute on function public.servicedesk_record_attribution_touch(jsonb) to service_role;
grant execute on function public.servicedesk_read_referral_attribution_summary(jsonb) to service_role;

comment on table public.lead_attribution_events is
  'Append-only lead and paid-job attribution events. Conversion rows freeze first/last touch event ids to avoid rewriting historical attribution.';
comment on function public.servicedesk_read_referral_attribution_summary(jsonb) is
  'Staff referral-to-paid-job summary from stored touch/conversion events. Attribution is directional and not represented as perfect causality.';
