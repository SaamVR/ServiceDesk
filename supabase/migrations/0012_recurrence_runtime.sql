-- ServiceDesk AI V1 INT7 / E07: authoritative recurrence core runtime
-- ServiceDesk owns recurrence truth. Providers must not own RRULE series.

alter table public.recurrence_rules
  add column if not exists status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PAUSED','COMPLETED')),
  add column if not exists generated_occurrences integer not null default 0
    check (generated_occurrences >= 0),
  add column if not exists next_occurrence_on date,
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists idempotency_key text;

update public.recurrence_rules
set status = case when active then 'ACTIVE' else 'PAUSED' end
where status is null;

update public.recurrence_rules
set next_occurrence_on = starts_on
where next_occurrence_on is null
  and status = 'ACTIVE';

create unique index if not exists recurrence_rules_idempotency_uq
  on public.recurrence_rules(workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists recurrence_rules_due_idx
  on public.recurrence_rules(workspace_id, status, next_occurrence_on)
  where status = 'ACTIVE' and next_occurrence_on is not null;

create table if not exists public.recurrence_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_id uuid not null,
  sequence integer not null check (sequence > 0),
  occurrence_on date not null,
  requested_start_at timestamptz not null,
  state text not null check (state in ('PENDING','MATERIALIZED','SKIPPED')),
  request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, rule_id, sequence),
  unique (workspace_id, rule_id, occurrence_on),
  foreign key (workspace_id, rule_id) references public.recurrence_rules(workspace_id, id) on delete cascade,
  foreign key (workspace_id, request_id) references public.requests(workspace_id, id) on delete restrict
);

create index if not exists recurrence_occurrences_rule_idx
  on public.recurrence_occurrences(workspace_id, rule_id, sequence);
create index if not exists recurrence_occurrences_request_idx
  on public.recurrence_occurrences(workspace_id, request_id)
  where request_id is not null;

alter table public.recurrence_occurrences enable row level security;

drop policy if exists recurrence_occurrences_staff_select on public.recurrence_occurrences;
create policy recurrence_occurrences_staff_select on public.recurrence_occurrences
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists recurrence_occurrences_customer_select on public.recurrence_occurrences;
create policy recurrence_occurrences_customer_select on public.recurrence_occurrences
for select to authenticated
using (
  exists (
    select 1
    from public.recurrence_rules rr
    join public.requests r on r.workspace_id = rr.workspace_id and r.id = rr.request_id
    where rr.workspace_id = recurrence_occurrences.workspace_id
      and rr.id = recurrence_occurrences.rule_id
      and r.customer_id is not null
      and public.is_customer_for_workspace(r.workspace_id, r.customer_id)
  )
);

drop function if exists public.servicedesk_recurrence_next_date(date, text, integer);
create function public.servicedesk_recurrence_next_date(
  p_current date,
  p_frequency text,
  p_anchor_day integer
)
returns date
language plpgsql
immutable
as $$
declare
  v_month date;
  v_days integer;
  v_anchor integer := coalesce(p_anchor_day, extract(day from p_current)::integer);
begin
  if p_current is null or p_frequency is null then
    raise exception 'recurrence date input required' using errcode = '22023';
  end if;

  if p_frequency = 'WEEKLY' then
    return p_current + 7;
  elsif p_frequency = 'FORTNIGHTLY' then
    return p_current + 14;
  elsif p_frequency = 'MONTHLY' then
    v_month := (date_trunc('month', p_current)::date + interval '1 month')::date;
    v_days := extract(day from (date_trunc('month', v_month)::date + interval '1 month - 1 day'))::integer;
    return make_date(extract(year from v_month)::integer, extract(month from v_month)::integer, least(v_anchor, v_days));
  end if;

  raise exception 'unsupported recurrence frequency %', p_frequency using errcode = '22023';
end;
$$;

drop function if exists public.servicedesk_recurrence_local_start(date, time, text);
create function public.servicedesk_recurrence_local_start(
  p_local_date date,
  p_local_time time,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
as $$
begin
  if p_local_date is null or p_local_time is null or p_timezone is null or length(trim(p_timezone)) = 0 then
    raise exception 'local recurrence timestamp input required' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid IANA timezone: %', p_timezone using errcode = '22023';
  end if;

  return make_timestamptz(
    extract(year from p_local_date)::integer,
    extract(month from p_local_date)::integer,
    extract(day from p_local_date)::integer,
    extract(hour from p_local_time)::integer,
    extract(minute from p_local_time)::integer,
    extract(second from p_local_time),
    p_timezone
  );
end;
$$;

drop function if exists public.servicedesk_recurrence_is_complete(date, date, integer, integer);
create function public.servicedesk_recurrence_is_complete(
  p_next date,
  p_ends_on date,
  p_generated integer,
  p_max integer
)
returns boolean
language sql
immutable
as $$
  select p_next is null
      or (p_ends_on is not null and p_next > p_ends_on)
      or (p_max is not null and p_generated >= p_max);
$$;

drop function if exists public.servicedesk_recurrence_rule_json(public.recurrence_rules);
create function public.servicedesk_recurrence_rule_json(p_rule public.recurrence_rules)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_rule.id,
    'workspaceId', p_rule.workspace_id,
    'requestId', p_rule.request_id,
    'propertyId', p_rule.property_id,
    'frequency', p_rule.frequency::text,
    'timezone', p_rule.timezone,
    'localStartTime', p_rule.local_start_time::text,
    'startsOn', p_rule.starts_on::text,
    'endsOn', case when p_rule.ends_on is null then null else p_rule.ends_on::text end,
    'maxOccurrences', p_rule.max_occurrences,
    'generatedOccurrences', p_rule.generated_occurrences,
    'status', p_rule.status,
    'nextOccurrenceOn', case when p_rule.next_occurrence_on is null then null else p_rule.next_occurrence_on::text end,
    'version', p_rule.version,
    'createdAt', p_rule.created_at,
    'updatedAt', p_rule.updated_at
  );
$$;

drop function if exists public.servicedesk_create_recurrence_rule(jsonb);
create function public.servicedesk_create_recurrence_rule(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_request_id uuid := (p_input->>'requestId')::uuid;
  v_property_id uuid := (p_input->>'propertyId')::uuid;
  v_frequency public.recurrence_frequency := (p_input->>'frequency')::public.recurrence_frequency;
  v_timezone text := nullif(trim(p_input->>'timezone'), '');
  v_local_time time := (p_input->>'localStartTime')::time;
  v_starts_on date := (p_input->>'startsOn')::date;
  v_ends_on date := nullif(p_input->>'endsOn','')::date;
  v_max integer := nullif(p_input->>'maxOccurrences','')::integer;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_request public.requests%rowtype;
  v_property public.properties%rowtype;
  v_existing public.recurrence_rules%rowtype;
  v_rule public.recurrence_rules%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_request_id is null or v_property_id is null
     or v_frequency is null or v_timezone is null or v_local_time is null or v_starts_on is null
     or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_RULE_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not exists (
       select 1 from public.memberships
       where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
     ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_TIMEZONE_INVALID');
  end if;
  if v_ends_on is not null and v_ends_on < v_starts_on then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_ENDS_ON_INVALID');
  end if;
  if v_max is not null and v_max < 1 then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_MAX_OCCURRENCES_INVALID');
  end if;

  select * into v_existing
  from public.recurrence_rules
  where workspace_id = v_workspace and idempotency_key = v_idempotency
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'rule', public.servicedesk_recurrence_rule_json(v_existing), 'duplicate', true);
  end if;

  select * into v_request
  from public.requests
  where workspace_id = v_workspace and id = v_request_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND'); end if;

  select * into v_property
  from public.properties
  where workspace_id = v_workspace and id = v_property_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'PROPERTY_NOT_FOUND'); end if;

  if v_request.property_id is distinct from v_property.id
     or v_request.customer_id is null
     or v_property.customer_id is distinct from v_request.customer_id
     or v_request.service_id is null then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_SOURCE_FACTS_INVALID');
  end if;

  perform public.servicedesk_recurrence_local_start(v_starts_on, v_local_time, v_timezone);

  insert into public.recurrence_rules(
    id, workspace_id, request_id, property_id, frequency, timezone, local_start_time,
    starts_on, ends_on, max_occurrences, active, status, generated_occurrences,
    next_occurrence_on, version, idempotency_key, created_at, updated_at
  ) values (
    gen_random_uuid(), v_workspace, v_request.id, v_property.id, v_frequency, v_timezone, v_local_time,
    v_starts_on, v_ends_on, v_max, true, 'ACTIVE', 0,
    case when public.servicedesk_recurrence_is_complete(v_starts_on, v_ends_on, 0, v_max) then null else v_starts_on end,
    1, v_idempotency, v_now, v_now
  )
  returning * into v_rule;

  if v_rule.next_occurrence_on is null then
    update public.recurrence_rules
    set status = 'COMPLETED', active = false, updated_at = v_now
    where workspace_id = v_workspace and id = v_rule.id
    returning * into v_rule;
  end if;

  return jsonb_build_object('ok', true, 'rule', public.servicedesk_recurrence_rule_json(v_rule), 'duplicate', false);
end;
$$;

drop function if exists public.servicedesk_apply_recurrence_rule_action(jsonb);
create function public.servicedesk_apply_recurrence_rule_action(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_rule_id uuid := coalesce(nullif(p_input->>'ruleId','')::uuid, nullif(p_input->>'recurrenceRuleId','')::uuid);
  v_action text := p_input->>'action';
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_rule public.recurrence_rules%rowtype;
  v_next date;
  v_generated integer;
  v_status text;
begin
  if v_workspace is null or v_actor_user is null or v_rule_id is null or v_action is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_ACTION_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not exists (
       select 1 from public.memberships
       where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
     ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_rule
  from public.recurrence_rules
  where workspace_id = v_workspace and id = v_rule_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'RECURRENCE_RULE_NOT_FOUND'); end if;
  if v_rule.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;

  if v_action = 'PAUSE' then
    if v_rule.status <> 'ACTIVE' then return jsonb_build_object('ok', false, 'code', 'RECURRENCE_STATE_INVALID'); end if;
    update public.recurrence_rules
    set status = 'PAUSED', active = false, version = version + 1, updated_at = v_now
    where workspace_id = v_workspace and id = v_rule.id
    returning * into v_rule;

  elsif v_action = 'RESUME' then
    if v_rule.status <> 'PAUSED' then return jsonb_build_object('ok', false, 'code', 'RECURRENCE_STATE_INVALID'); end if;
    if public.servicedesk_recurrence_is_complete(v_rule.next_occurrence_on, v_rule.ends_on, v_rule.generated_occurrences, v_rule.max_occurrences) then
      update public.recurrence_rules
      set status = 'COMPLETED', active = false, version = version + 1, updated_at = v_now
      where workspace_id = v_workspace and id = v_rule.id
      returning * into v_rule;
    else
      update public.recurrence_rules
      set status = 'ACTIVE', active = true, version = version + 1, updated_at = v_now
      where workspace_id = v_workspace and id = v_rule.id
      returning * into v_rule;
    end if;

  elsif v_action = 'SKIP_NEXT' then
    if v_rule.status <> 'ACTIVE' or v_rule.next_occurrence_on is null then
      return jsonb_build_object('ok', false, 'code', 'RECURRENCE_STATE_INVALID');
    end if;

    insert into public.recurrence_occurrences(
      id, workspace_id, rule_id, sequence, occurrence_on, requested_start_at, state, created_at, updated_at
    ) values (
      gen_random_uuid(), v_workspace, v_rule.id, v_rule.generated_occurrences + 1,
      v_rule.next_occurrence_on,
      public.servicedesk_recurrence_local_start(v_rule.next_occurrence_on, v_rule.local_start_time, v_rule.timezone),
      'SKIPPED', v_now, v_now
    );

    v_generated := v_rule.generated_occurrences + 1;
    v_next := public.servicedesk_recurrence_next_date(v_rule.next_occurrence_on, v_rule.frequency::text, extract(day from v_rule.starts_on)::integer);
    v_status := case when public.servicedesk_recurrence_is_complete(v_next, v_rule.ends_on, v_generated, v_rule.max_occurrences) then 'COMPLETED' else 'ACTIVE' end;

    update public.recurrence_rules
    set generated_occurrences = v_generated,
        next_occurrence_on = case when v_status = 'COMPLETED' then null else v_next end,
        status = v_status,
        active = (v_status = 'ACTIVE'),
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace and id = v_rule.id
    returning * into v_rule;

  else
    return jsonb_build_object('ok', false, 'code', 'RECURRENCE_ACTION_UNSUPPORTED');
  end if;

  return jsonb_build_object('ok', true, 'rule', public.servicedesk_recurrence_rule_json(v_rule));
end;
$$;

drop function if exists public.servicedesk_materialize_due_recurrences(jsonb);
create function public.servicedesk_materialize_due_recurrences(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace_filter uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_due_on date := coalesce(nullif(p_input->>'dueOn','')::date, current_date);
  v_limit integer := greatest(1, least(coalesce(nullif(p_input->>'limit','')::integer, 25), 100));
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_rule public.recurrence_rules%rowtype;
  v_source public.requests%rowtype;
  v_occurrence_id uuid;
  v_new_request_id uuid;
  v_requested_start timestamptz;
  v_sequence integer;
  v_new_status public.request_status;
  v_next date;
  v_generated integer;
  v_status text;
  v_count integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  for v_rule in
    select *
    from public.recurrence_rules
    where status = 'ACTIVE'
      and next_occurrence_on is not null
      and next_occurrence_on <= v_due_on
      and (v_workspace_filter is null or workspace_id = v_workspace_filter)
    order by next_occurrence_on, created_at, id
    limit v_limit
    for update skip locked
  loop
    select * into v_source
    from public.requests
    where workspace_id = v_rule.workspace_id and id = v_rule.request_id
    for update;

    if not found then
      update public.recurrence_rules
      set status = 'COMPLETED', active = false, version = version + 1, updated_at = v_now
      where workspace_id = v_rule.workspace_id and id = v_rule.id;
      continue;
    end if;

    v_sequence := v_rule.generated_occurrences + 1;
    v_requested_start := public.servicedesk_recurrence_local_start(v_rule.next_occurrence_on, v_rule.local_start_time, v_rule.timezone);

    insert into public.recurrence_occurrences(
      id, workspace_id, rule_id, sequence, occurrence_on, requested_start_at, state, created_at, updated_at
    ) values (
      gen_random_uuid(), v_rule.workspace_id, v_rule.id, v_sequence, v_rule.next_occurrence_on,
      v_requested_start, 'PENDING', v_now, v_now
    )
    on conflict (workspace_id, rule_id, occurrence_on) do nothing
    returning id into v_occurrence_id;

    if v_occurrence_id is null then
      continue;
    end if;

    v_new_status := case
      when v_source.customer_id is null or v_source.property_id is null or v_source.service_id is null then 'NEEDS_REVIEW'::public.request_status
      else 'READY'::public.request_status
    end;

    insert into public.requests(
      id, workspace_id, customer_id, property_id, service_id, visitor_session_id, status,
      bedrooms, bathrooms, requested_start_at, structured_fields, assigned_user_id,
      version, created_at, updated_at
    ) values (
      gen_random_uuid(), v_source.workspace_id, v_source.customer_id, v_source.property_id, v_source.service_id, null, v_new_status,
      v_source.bedrooms, v_source.bathrooms, v_requested_start,
      coalesce(v_source.structured_fields, '{}'::jsonb)
        || jsonb_build_object('recurrenceRuleId', v_rule.id, 'recurrenceSequence', v_sequence, 'recurrenceOccurrenceOn', v_rule.next_occurrence_on),
      null, 1, v_now, v_now
    )
    returning id into v_new_request_id;

    update public.recurrence_occurrences
    set state = 'MATERIALIZED', request_id = v_new_request_id, updated_at = v_now
    where workspace_id = v_rule.workspace_id and id = v_occurrence_id;

    v_generated := v_rule.generated_occurrences + 1;
    v_next := public.servicedesk_recurrence_next_date(v_rule.next_occurrence_on, v_rule.frequency::text, extract(day from v_rule.starts_on)::integer);
    v_status := case when public.servicedesk_recurrence_is_complete(v_next, v_rule.ends_on, v_generated, v_rule.max_occurrences) then 'COMPLETED' else 'ACTIVE' end;

    update public.recurrence_rules
    set generated_occurrences = v_generated,
        next_occurrence_on = case when v_status = 'COMPLETED' then null else v_next end,
        status = v_status,
        active = (v_status = 'ACTIVE'),
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_rule.workspace_id and id = v_rule.id
    returning * into v_rule;

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'ruleId', v_rule.id,
      'occurrenceId', v_occurrence_id,
      'requestId', v_new_request_id,
      'sequence', v_sequence,
      'occurrenceOn', (select occurrence_on::text from public.recurrence_occurrences where id = v_occurrence_id),
      'requestedStartAt', v_requested_start
    ));
  end loop;

  return jsonb_build_object('ok', true, 'materializedCount', v_count, 'materialized', v_results);
end;
$$;

drop function if exists public.servicedesk_read_workspace_snapshot(jsonb);
create function public.servicedesk_read_workspace_snapshot(p_input jsonb)
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
  v_conversation_filter uuid := nullif(p_input->>'conversationId','')::uuid;
  v_visit_filter uuid := nullif(p_input->>'visitId','')::uuid;
  v_invoice_filter uuid := nullif(p_input->>'invoiceId','')::uuid;
  v_customer_id uuid;
  v_staff boolean;
begin
  v_staff := v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships
    where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  );

  if v_staff then
    return jsonb_build_object(
      'ok', true,
      'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.requests r where r.workspace_id = v_workspace and (v_customer_filter is null or r.customer_id = v_customer_filter)), '[]'::jsonb),
      'quotes', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from public.quotes q where q.workspace_id = v_workspace), '[]'::jsonb),
      'visits', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at desc) from public.visits v where v.workspace_id = v_workspace and (v_visit_filter is null or v.id = v_visit_filter)), '[]'::jsonb),
      'invoices', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.invoices i where i.workspace_id = v_workspace and (v_invoice_filter is null or i.id = v_invoice_filter)), '[]'::jsonb),
      'conversations', coalesce((select jsonb_agg(to_jsonb(c) order by coalesce(c.last_message_at,c.created_at) desc) from public.conversations c where c.workspace_id = v_workspace and (v_customer_filter is null or c.customer_id = v_customer_filter) and (v_conversation_filter is null or c.id = v_conversation_filter)), '[]'::jsonb),
      'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at asc) from public.messages m join public.conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id where m.workspace_id = v_workspace and (v_customer_filter is null or c.customer_id = v_customer_filter) and (v_conversation_filter is null or c.id = v_conversation_filter)), '[]'::jsonb),
      'recurrenceRules', coalesce((select jsonb_agg(public.servicedesk_recurrence_rule_json(rr) order by rr.created_at desc) from public.recurrence_rules rr where rr.workspace_id = v_workspace and (v_customer_filter is null or exists (select 1 from public.requests r where r.workspace_id = rr.workspace_id and r.id = rr.request_id and r.customer_id = v_customer_filter))), '[]'::jsonb),
      'visitEvidence', coalesce((select jsonb_agg(jsonb_build_object('id', ve.id, 'workspaceId', ve.workspace_id, 'visitId', ve.visit_id, 'kind', ve.kind, 'mediaReference', ve.media_reference, 'text', ve.text, 'capturedAt', ve.captured_at, 'submittedByUserId', ve.submitted_by_user_id, 'createdAt', ve.created_at) order by ve.created_at desc) from public.visit_evidence ve where ve.workspace_id = v_workspace and (v_visit_filter is null or ve.visit_id = v_visit_filter)), '[]'::jsonb),
      'visitChecklistItems', coalesce((select jsonb_agg(jsonb_build_object('id', vc.id, 'workspaceId', vc.workspace_id, 'visitId', vc.visit_id, 'itemKey', vc.item_key, 'completed', vc.completed, 'note', vc.note, 'updatedByUserId', vc.updated_by_user_id, 'updatedAt', vc.updated_at, 'version', vc.version) order by vc.updated_at desc) from public.visit_checklist_items vc where vc.workspace_id = v_workspace and (v_visit_filter is null or vc.visit_id = v_visit_filter)), '[]'::jsonb),
      'attentionItems', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'workspaceId', a.workspace_id, 'type', a.type, 'severity', a.severity::text, 'status', a.status::text, 'resourceType', a.resource_type, 'resourceId', a.resource_id, 'ownerUserId', a.owner_user_id, 'dueAt', a.due_at, 'summary', a.summary) order by a.created_at desc) from public.attention_items a where a.workspace_id = v_workspace), '[]'::jsonb),
      'qualityCases', '[]'::jsonb
    );
  elsif v_actor_role = 'CUSTOMER' then
    select id into v_customer_id
    from public.customers
    where workspace_id = v_workspace and auth_user_id = v_actor_user and archived_at is null
    limit 1;

    if v_customer_id is null then
      return jsonb_build_object('ok', false, 'code', 'CUSTOMER_SCOPE_REQUIRED');
    end if;

    return jsonb_build_object(
      'ok', true,
      'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.requests r where r.workspace_id = v_workspace and r.customer_id = v_customer_id), '[]'::jsonb),
      'quotes', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from public.quotes q join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id where q.workspace_id = v_workspace and r.customer_id = v_customer_id), '[]'::jsonb),
      'visits', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at desc) from public.visits v join public.requests r on r.workspace_id = v.workspace_id and r.id = v.request_id where v.workspace_id = v_workspace and r.customer_id = v_customer_id), '[]'::jsonb),
      'invoices', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.invoices i join public.quotes q on q.workspace_id = i.workspace_id and q.id = i.quote_id join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id where i.workspace_id = v_workspace and r.customer_id = v_customer_id), '[]'::jsonb),
      'conversations', coalesce((select jsonb_agg(to_jsonb(c) order by coalesce(c.last_message_at,c.created_at) desc) from public.conversations c where c.workspace_id = v_workspace and c.customer_id = v_customer_id), '[]'::jsonb),
      'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at asc) from public.messages m join public.conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id where m.workspace_id = v_workspace and c.customer_id = v_customer_id), '[]'::jsonb),
      'recurrenceRules', coalesce((select jsonb_agg(public.servicedesk_recurrence_rule_json(rr) order by rr.created_at desc) from public.recurrence_rules rr join public.requests r on r.workspace_id = rr.workspace_id and r.id = rr.request_id where rr.workspace_id = v_workspace and r.customer_id = v_customer_id), '[]'::jsonb),
      'visitEvidence', '[]'::jsonb,
      'visitChecklistItems', '[]'::jsonb,
      'attentionItems', '[]'::jsonb,
      'qualityCases', '[]'::jsonb
    );
  end if;

  return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
end;
$$;

revoke all on function public.servicedesk_recurrence_next_date(date, text, integer) from public;
revoke all on function public.servicedesk_recurrence_local_start(date, time, text) from public;
revoke all on function public.servicedesk_recurrence_is_complete(date, date, integer, integer) from public;
revoke all on function public.servicedesk_recurrence_rule_json(public.recurrence_rules) from public;

revoke all on function public.servicedesk_create_recurrence_rule(jsonb) from public;
revoke all on function public.servicedesk_create_recurrence_rule(jsonb) from anon;
revoke all on function public.servicedesk_create_recurrence_rule(jsonb) from authenticated;
grant execute on function public.servicedesk_create_recurrence_rule(jsonb) to service_role;

revoke all on function public.servicedesk_apply_recurrence_rule_action(jsonb) from public;
revoke all on function public.servicedesk_apply_recurrence_rule_action(jsonb) from anon;
revoke all on function public.servicedesk_apply_recurrence_rule_action(jsonb) from authenticated;
grant execute on function public.servicedesk_apply_recurrence_rule_action(jsonb) to service_role;

revoke all on function public.servicedesk_materialize_due_recurrences(jsonb) from public;
revoke all on function public.servicedesk_materialize_due_recurrences(jsonb) from anon;
revoke all on function public.servicedesk_materialize_due_recurrences(jsonb) from authenticated;
grant execute on function public.servicedesk_materialize_due_recurrences(jsonb) to service_role;

revoke all on function public.servicedesk_read_workspace_snapshot(jsonb) from public;
revoke all on function public.servicedesk_read_workspace_snapshot(jsonb) from anon;
revoke all on function public.servicedesk_read_workspace_snapshot(jsonb) from authenticated;
grant execute on function public.servicedesk_read_workspace_snapshot(jsonb) to service_role;

comment on table public.recurrence_occurrences is 'Authoritative ServiceDesk recurrence occurrence ledger. Product/providers must not calculate recurrence truth.';
comment on function public.servicedesk_materialize_due_recurrences(jsonb) is 'Trusted server recurrence materializer. Creates recurring requests only; never visits or provider RRULE series.';
