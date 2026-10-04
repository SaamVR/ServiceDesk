-- ServiceDesk AI V1 E10B: early authoritative command closure
-- Closes E01/E02 persistence seams without moving deterministic quote calculation into SQL.

create table if not exists public.servicedesk_command_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  command_scope text not null check (length(trim(command_scope)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  resource_type text not null check (length(trim(resource_type)) > 0),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, command_scope, idempotency_key)
);

alter table public.servicedesk_command_idempotency enable row level security;

drop policy if exists servicedesk_command_idempotency_no_client_access on public.servicedesk_command_idempotency;
-- No client policy: trusted service_role RPCs own command idempotency.

create or replace function public.servicedesk_require_staff(p_workspace uuid, p_actor_user uuid, p_actor_role text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships
    where workspace_id = p_workspace
      and user_id = p_actor_user
      and status = 'ACTIVE'
      and role in ('OWNER','DISPATCHER')
  );
$$;

create or replace function public.servicedesk_request_json(p_request public.requests)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_request.id is null then null else jsonb_build_object(
    'id', p_request.id,
    'workspaceId', p_request.workspace_id,
    'customerId', p_request.customer_id,
    'propertyId', p_request.property_id,
    'serviceCode', sc.code,
    'status', p_request.status::text,
    'bedrooms', nullif((p_request.structured_fields->>'bedrooms')::int, null),
    'bathrooms', nullif((p_request.structured_fields->>'bathrooms')::int, null),
    'requestedStartAt', p_request.requested_start_at,
    'visitorSessionId', p_request.visitor_session_id,
    'version', p_request.version,
    'createdAt', p_request.created_at,
    'updatedAt', p_request.updated_at
  ) end
  from public.service_catalog sc
  where sc.workspace_id = p_request.workspace_id and sc.id = p_request.service_id;
$$;

create or replace function public.servicedesk_quote_json(p_quote public.quotes)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_quote.id is null then null else jsonb_build_object(
    'id', p_quote.id,
    'workspaceId', p_quote.workspace_id,
    'requestId', p_quote.request_id,
    'version', p_quote.version,
    'status', p_quote.status::text,
    'serviceCode', p_quote.service_code,
    'currency', p_quote.currency,
    'subtotalMinor', p_quote.subtotal_minor,
    'taxMinor', p_quote.tax_minor,
    'totalMinor', p_quote.total_minor,
    'depositMinor', p_quote.deposit_minor,
    'balanceMinor', p_quote.balance_minor,
    'durationMinutes', p_quote.duration_minutes,
    'bufferMinutes', p_quote.buffer_minutes,
    'rateVersion', p_quote.rate_version,
    'validUntil', p_quote.valid_until,
    'snapshot', p_quote.snapshot,
    'acceptedAt', p_quote.accepted_at
  ) end;
$$;

create or replace function public.servicedesk_slot_json(p_slot public.capacity_slots)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_slot.id is null then null else jsonb_build_object(
    'id', p_slot.id,
    'workspaceId', p_slot.workspace_id,
    'crewId', p_slot.crew_id,
    'startAt', p_slot.starts_at,
    'endAt', p_slot.ends_at,
    'startsAt', p_slot.starts_at,
    'endsAt', p_slot.ends_at,
    'capacityMinutes', p_slot.capacity_minutes,
    'timezone', p_slot.timezone
  ) end;
$$;

create or replace function public.servicedesk_hold_json(p_hold public.slot_holds)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_hold.id is null then null else jsonb_build_object(
    'id', p_hold.id,
    'workspaceId', p_hold.workspace_id,
    'slotId', p_hold.slot_id,
    'quoteId', p_hold.quote_id,
    'status', p_hold.status::text,
    'expiresAt', p_hold.expires_at,
    'createdAt', p_hold.created_at,
    'updatedAt', p_hold.updated_at
  ) end;
$$;

create or replace function public.servicedesk_create_customer(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_display text := nullif(trim(p_input->>'displayName'), '');
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_customer public.customers%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_display is null or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_INPUT_INVALID');
  end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_existing from public.servicedesk_command_idempotency
  where workspace_id = v_workspace and command_scope = 'customer.create' and idempotency_key = v_idempotency;
  if found then
    select * into v_customer from public.customers where workspace_id = v_workspace and id = v_existing.resource_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'customer', jsonb_build_object('id', v_customer.id, 'workspaceId', v_customer.workspace_id, 'displayName', v_customer.display_name));
  end if;

  insert into public.customers(id, workspace_id, auth_user_id, display_name, lead_source, notes, version, created_at, updated_at)
  values (coalesce(nullif(p_input->>'customerId','')::uuid, gen_random_uuid()), v_workspace, nullif(p_input->>'authUserId','')::uuid,
          v_display, nullif(p_input->>'leadSource',''), nullif(p_input->>'notes',''), 1, now(), now())
  returning * into v_customer;

  insert into public.servicedesk_command_idempotency(workspace_id, command_scope, idempotency_key, resource_type, resource_id)
  values (v_workspace, 'customer.create', v_idempotency, 'customer', v_customer.id);

  return jsonb_build_object('ok', true, 'duplicate', false, 'customer', jsonb_build_object('id', v_customer.id, 'workspaceId', v_customer.workspace_id, 'displayName', v_customer.display_name));
exception when foreign_key_violation or unique_violation or check_violation then
  return jsonb_build_object('ok', false, 'code', 'CUSTOMER_CREATE_REJECTED');
end;
$$;

create or replace function public.servicedesk_create_property(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_customer uuid := (p_input->>'customerId')::uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_property public.properties%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_customer is null or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'PROPERTY_INPUT_INVALID');
  end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not exists (select 1 from public.customers where workspace_id = v_workspace and id = v_customer and archived_at is null) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  select * into v_existing from public.servicedesk_command_idempotency
  where workspace_id = v_workspace and command_scope = 'property.create' and idempotency_key = v_idempotency;
  if found then
    select * into v_property from public.properties where workspace_id = v_workspace and id = v_existing.resource_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'property', jsonb_build_object('id', v_property.id, 'workspaceId', v_property.workspace_id, 'customerId', v_property.customer_id));
  end if;

  insert into public.properties(id, workspace_id, customer_id, label, address_line1, address_line2, city, region, postal_code, country_code, service_notes, access_notes, version, created_at, updated_at)
  values (coalesce(nullif(p_input->>'propertyId','')::uuid, gen_random_uuid()), v_workspace, v_customer,
          nullif(p_input->>'label',''), coalesce(nullif(p_input->>'addressLine1',''), 'Synthetic address'), nullif(p_input->>'addressLine2',''),
          coalesce(nullif(p_input->>'city',''), 'Synthetic city'), nullif(p_input->>'region',''), coalesce(nullif(p_input->>'postalCode',''), '00000'),
          coalesce(nullif(p_input->>'countryCode',''), 'US'), nullif(p_input->>'serviceNotes',''), nullif(p_input->>'accessNotes',''), 1, now(), now())
  returning * into v_property;

  insert into public.servicedesk_command_idempotency(workspace_id, command_scope, idempotency_key, resource_type, resource_id)
  values (v_workspace, 'property.create', v_idempotency, 'property', v_property.id);

  return jsonb_build_object('ok', true, 'duplicate', false, 'property', jsonb_build_object('id', v_property.id, 'workspaceId', v_property.workspace_id, 'customerId', v_property.customer_id));
exception when foreign_key_violation or unique_violation or check_violation then
  return jsonb_build_object('ok', false, 'code', 'PROPERTY_CREATE_REJECTED');
end;
$$;

create or replace function public.servicedesk_create_request(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_visitor text := nullif(p_input->>'visitorSessionId','');
  v_customer uuid := nullif(p_input->>'customerId','')::uuid;
  v_property uuid := nullif(p_input->>'propertyId','')::uuid;
  v_service_code text := nullif(p_input->>'serviceCode','');
  v_service uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_request public.requests%rowtype;
  v_fields jsonb := '{}'::jsonb;
begin
  if v_workspace is null or v_idempotency is null then return jsonb_build_object('ok', false, 'code', 'REQUEST_INPUT_INVALID'); end if;
  if v_actor_role = 'VISITOR' then
    if v_visitor is null or v_visitor is distinct from nullif(p_input->>'actorVisitorSessionId','') then
      return jsonb_build_object('ok', false, 'code', 'VISITOR_SCOPE_REQUIRED');
    end if;
  elsif not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_customer is not null and not exists (select 1 from public.customers where workspace_id = v_workspace and id = v_customer) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND');
  end if;
  if v_property is not null and not exists (select 1 from public.properties where workspace_id = v_workspace and id = v_property and (v_customer is null or customer_id = v_customer)) then
    return jsonb_build_object('ok', false, 'code', 'PROPERTY_NOT_FOUND');
  end if;
  if v_service_code is not null then
    select id into v_service from public.service_catalog where workspace_id = v_workspace and code = v_service_code and active = true;
    if v_service is null then return jsonb_build_object('ok', false, 'code', 'SERVICE_NOT_FOUND'); end if;
  end if;

  select * into v_existing from public.servicedesk_command_idempotency where workspace_id = v_workspace and command_scope = 'request.create' and idempotency_key = v_idempotency;
  if found then
    select * into v_request from public.requests where workspace_id = v_workspace and id = v_existing.resource_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'request', public.servicedesk_request_json(v_request));
  end if;

  if p_input ? 'bedrooms' then v_fields := v_fields || jsonb_build_object('bedrooms', (p_input->>'bedrooms')::int); end if;
  if p_input ? 'bathrooms' then v_fields := v_fields || jsonb_build_object('bathrooms', (p_input->>'bathrooms')::int); end if;

  insert into public.requests(id, workspace_id, customer_id, property_id, service_id, visitor_session_id, status, bedrooms, bathrooms, requested_start_at, structured_fields, version, created_at, updated_at)
  values (coalesce(nullif(p_input->>'requestId','')::uuid, gen_random_uuid()), v_workspace, v_customer, v_property, v_service, v_visitor, 'NEW',
          nullif(p_input->>'bedrooms','')::int, nullif(p_input->>'bathrooms','')::int, nullif(p_input->>'requestedStartAt','')::timestamptz, v_fields, 1, now(), now())
  returning * into v_request;

  insert into public.servicedesk_command_idempotency(workspace_id, command_scope, idempotency_key, resource_type, resource_id)
  values (v_workspace, 'request.create', v_idempotency, 'request', v_request.id);

  return jsonb_build_object('ok', true, 'duplicate', false, 'request', public.servicedesk_request_json(v_request));
exception when foreign_key_violation or unique_violation or check_violation then
  return jsonb_build_object('ok', false, 'code', 'REQUEST_CREATE_REJECTED');
end;
$$;

create or replace function public.servicedesk_update_request(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_visitor text := nullif(p_input->>'actorVisitorSessionId','');
  v_request_id uuid := (p_input->>'requestId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_request public.requests%rowtype;
  v_customer uuid;
  v_property uuid;
  v_service uuid;
  v_fields jsonb;
begin
  if v_workspace is null or v_request_id is null or v_expected is null then return jsonb_build_object('ok', false, 'code', 'REQUEST_UPDATE_INVALID'); end if;
  select * into v_request from public.requests where workspace_id = v_workspace and id = v_request_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND'); end if;
  if v_actor_role = 'VISITOR' then
    if v_request.visitor_session_id is null or v_request.visitor_session_id is distinct from v_actor_visitor or p_input ? 'status' then
      return jsonb_build_object('ok', false, 'code', 'VISITOR_SCOPE_REQUIRED');
    end if;
  elsif not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_request.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;

  v_customer := coalesce(nullif(p_input->>'customerId','')::uuid, v_request.customer_id);
  v_property := coalesce(nullif(p_input->>'propertyId','')::uuid, v_request.property_id);
  if p_input ? 'serviceCode' then
    select id into v_service from public.service_catalog where workspace_id = v_workspace and code = p_input->>'serviceCode' and active = true;
    if v_service is null then return jsonb_build_object('ok', false, 'code', 'SERVICE_NOT_FOUND'); end if;
  else
    v_service := v_request.service_id;
  end if;
  if v_customer is not null and not exists (select 1 from public.customers where workspace_id = v_workspace and id = v_customer) then return jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND'); end if;
  if v_property is not null and not exists (select 1 from public.properties where workspace_id = v_workspace and id = v_property and (v_customer is null or customer_id = v_customer)) then return jsonb_build_object('ok', false, 'code', 'PROPERTY_NOT_FOUND'); end if;

  v_fields := v_request.structured_fields;
  if p_input ? 'bedrooms' then v_fields := v_fields || jsonb_build_object('bedrooms', (p_input->>'bedrooms')::int); end if;
  if p_input ? 'bathrooms' then v_fields := v_fields || jsonb_build_object('bathrooms', (p_input->>'bathrooms')::int); end if;

  update public.requests
  set customer_id = v_customer,
      property_id = v_property,
      service_id = v_service,
      bedrooms = coalesce(nullif(p_input->>'bedrooms','')::int, bedrooms),
      bathrooms = coalesce(nullif(p_input->>'bathrooms','')::int, bathrooms),
      requested_start_at = coalesce(nullif(p_input->>'requestedStartAt','')::timestamptz, requested_start_at),
      status = coalesce(nullif(p_input->>'status','')::public.request_status, status),
      structured_fields = v_fields,
      version = version + 1,
      updated_at = now()
  where workspace_id = v_workspace and id = v_request_id
  returning * into v_request;

  return jsonb_build_object('ok', true, 'request', public.servicedesk_request_json(v_request));
exception when foreign_key_violation or unique_violation or check_violation then
  return jsonb_build_object('ok', false, 'code', 'REQUEST_UPDATE_REJECTED');
end;
$$;

create or replace function public.servicedesk_persist_quote_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_quote_id uuid := coalesce(nullif(p_input->>'quoteId','')::uuid, gen_random_uuid());
  v_request_id uuid := (p_input->>'requestId')::uuid;
  v_snapshot jsonb := p_input->'snapshot';
  v_prev public.quotes%rowtype;
  v_quote public.quotes%rowtype;
  v_next_version bigint;
begin
  if v_workspace is null or v_actor_user is null or v_request_id is null or v_snapshot is null then return jsonb_build_object('ok', false, 'code', 'QUOTE_INPUT_INVALID'); end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if not exists (select 1 from public.requests where workspace_id = v_workspace and id = v_request_id for update) then return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND'); end if;

  select * into v_prev from public.quotes where workspace_id = v_workspace and request_id = v_request_id order by version desc limit 1 for update;
  v_next_version := coalesce(v_prev.version, 0) + 1;

  insert into public.quotes(id, workspace_id, request_id, version, status, service_code, currency, subtotal_minor, tax_minor, total_minor, deposit_minor, balance_minor, duration_minutes, buffer_minutes, rate_version, valid_until, snapshot, created_at, updated_at)
  values (v_quote_id, v_workspace, v_request_id, v_next_version, (v_snapshot->>'status')::public.quote_status, v_snapshot->>'serviceCode', upper(v_snapshot->>'currency'),
          (v_snapshot->>'subtotalMinor')::int, (v_snapshot->>'taxMinor')::int, (v_snapshot->>'totalMinor')::int, (v_snapshot->>'depositMinor')::int, (v_snapshot->>'balanceMinor')::int,
          (v_snapshot->>'durationMinutes')::int, (v_snapshot->>'bufferMinutes')::int, v_snapshot->>'rateVersion', (v_snapshot->>'validUntil')::timestamptz,
          jsonb_set(jsonb_set(jsonb_set(v_snapshot, '{id}', to_jsonb(v_quote_id::text), true), '{version}', to_jsonb(v_next_version), true), '{workspaceId}', to_jsonb(v_workspace::text), true), now(), now())
  returning * into v_quote;

  if v_prev.id is not null and v_prev.status <> 'SUPERSEDED' then
    update public.quotes set status = 'SUPERSEDED', superseded_by = v_quote.id, updated_at = now()
    where workspace_id = v_workspace and id = v_prev.id;
  end if;

  if v_snapshot ? 'lineItems' then
    insert into public.quote_items(id, workspace_id, quote_id, code, description, amount_minor, duration_minutes, sort_order)
    select gen_random_uuid(), v_workspace, v_quote.id, item->>'code', item->>'description', (item->>'amountMinor')::int, coalesce((item->>'durationMinutes')::int, 0), ordinality::int
    from jsonb_array_elements(v_snapshot->'lineItems') with ordinality as t(item, ordinality);
  end if;

  return jsonb_build_object('ok', true, 'quote', public.servicedesk_quote_json(v_quote));
exception when others then
  return jsonb_build_object('ok', false, 'code', 'QUOTE_PERSIST_REJECTED');
end;
$$;

create or replace function public.servicedesk_send_quote(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_quote_id uuid := (p_input->>'quoteId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_quote public.quotes%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_quote_id is null or v_expected is null then return jsonb_build_object('ok', false, 'code', 'QUOTE_SEND_INVALID'); end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select * into v_quote from public.quotes where workspace_id = v_workspace and id = v_quote_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_FOUND'); end if;
  if v_quote.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;
  if v_quote.status <> 'APPROVED' then return jsonb_build_object('ok', false, 'code', 'QUOTE_APPROVAL_REQUIRED'); end if;
  update public.quotes set status = 'SENT', updated_at = now() where workspace_id = v_workspace and id = v_quote.id returning * into v_quote;
  return jsonb_build_object('ok', true, 'quote', public.servicedesk_quote_json(v_quote));
end;
$$;

create or replace function public.servicedesk_accept_quote(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_visitor text := nullif(p_input->>'actorVisitorSessionId','');
  v_quote_id uuid := (p_input->>'quoteId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_quote public.quotes%rowtype;
  v_request public.requests%rowtype;
begin
  if v_workspace is null or v_quote_id is null or v_expected is null then return jsonb_build_object('ok', false, 'code', 'QUOTE_ACCEPT_INVALID'); end if;
  select * into v_quote from public.quotes where workspace_id = v_workspace and id = v_quote_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_FOUND'); end if;
  select * into v_request from public.requests where workspace_id = v_workspace and id = v_quote.request_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND'); end if;

  if v_actor_role = 'VISITOR' then
    if v_request.visitor_session_id is null or v_request.visitor_session_id is distinct from v_actor_visitor then return jsonb_build_object('ok', false, 'code', 'VISITOR_SCOPE_REQUIRED'); end if;
  elsif v_actor_role = 'CUSTOMER' then
    if v_actor_user is null or not exists (select 1 from public.customers where workspace_id = v_workspace and id = v_request.customer_id and auth_user_id = v_actor_user) then return jsonb_build_object('ok', false, 'code', 'CUSTOMER_SCOPE_REQUIRED'); end if;
  elsif v_actor_role in ('OWNER','DISPATCHER') then
    if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  else
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_quote.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;
  if v_quote.status = 'ACCEPTED' then return jsonb_build_object('ok', true, 'duplicate', true, 'quote', public.servicedesk_quote_json(v_quote)); end if;
  if v_quote.status <> 'SENT' then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_SENT'); end if;
  if v_now > v_quote.valid_until then return jsonb_build_object('ok', false, 'code', 'QUOTE_EXPIRED'); end if;

  update public.quotes set status = 'ACCEPTED', accepted_at = v_now, updated_at = v_now where workspace_id = v_workspace and id = v_quote.id returning * into v_quote;
  update public.requests set status = 'QUOTED', updated_at = v_now where workspace_id = v_workspace and id = v_request.id and status in ('NEW','COLLECTING','READY','NEEDS_REVIEW');
  return jsonb_build_object('ok', true, 'duplicate', false, 'quote', public.servicedesk_quote_json(v_quote));
end;
$$;

create or replace function public.servicedesk_upsert_capacity_slot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_slot_id uuid := coalesce(nullif(p_input->>'slotId','')::uuid, gen_random_uuid());
  v_crew_id uuid := (p_input->>'crewId')::uuid;
  v_slot public.capacity_slots%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_crew_id is null then return jsonb_build_object('ok', false, 'code', 'CAPACITY_SLOT_INPUT_INVALID'); end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if not exists (select 1 from public.crews where workspace_id = v_workspace and id = v_crew_id and active = true) then return jsonb_build_object('ok', false, 'code', 'CREW_NOT_FOUND'); end if;
  insert into public.capacity_slots(id, workspace_id, crew_id, starts_at, ends_at, capacity_minutes, timezone, created_at)
  values (v_slot_id, v_workspace, v_crew_id, (p_input->>'startsAt')::timestamptz, (p_input->>'endsAt')::timestamptz, (p_input->>'capacityMinutes')::int, coalesce(nullif(p_input->>'timezone',''), 'UTC'), now())
  on conflict (workspace_id, id) do update set crew_id = excluded.crew_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at, capacity_minutes = excluded.capacity_minutes, timezone = excluded.timezone
  returning * into v_slot;
  return jsonb_build_object('ok', true, 'slot', public.servicedesk_slot_json(v_slot));
exception when foreign_key_violation or check_violation then
  return jsonb_build_object('ok', false, 'code', 'CAPACITY_SLOT_REJECTED');
end;
$$;

create or replace function public.servicedesk_hold_slot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_slot_id uuid := (p_input->>'slotId')::uuid;
  v_quote_id uuid := (p_input->>'quoteId')::uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_slot public.capacity_slots%rowtype;
  v_quote public.quotes%rowtype;
  v_hold public.slot_holds%rowtype;
  v_required int;
begin
  if v_workspace is null or v_actor_user is null or v_slot_id is null or v_quote_id is null or v_idempotency is null then return jsonb_build_object('ok', false, 'code', 'HOLD_INPUT_INVALID'); end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select * into v_hold from public.slot_holds where workspace_id = v_workspace and idempotency_key = v_idempotency;
  if found then return jsonb_build_object('ok', true, 'duplicate', true, 'hold', public.servicedesk_hold_json(v_hold)); end if;

  update public.slot_holds set status = 'EXPIRED', updated_at = v_now where workspace_id = v_workspace and status = 'HELD' and expires_at <= v_now;
  select * into v_slot from public.capacity_slots where workspace_id = v_workspace and id = v_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'SLOT_NOT_FOUND'); end if;
  select * into v_quote from public.quotes where workspace_id = v_workspace and id = v_quote_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_FOUND'); end if;
  if v_quote.status <> 'ACCEPTED' then return jsonb_build_object('ok', false, 'code', 'QUOTE_ACCEPTED_REQUIRED'); end if;
  v_required := v_quote.duration_minutes + v_quote.buffer_minutes;
  if v_required > v_slot.capacity_minutes or v_slot.ends_at < v_slot.starts_at + make_interval(mins => v_required) then return jsonb_build_object('ok', false, 'code', 'SLOT_CAPACITY_EXCEEDED'); end if;
  if exists (select 1 from public.slot_holds where workspace_id = v_workspace and slot_id = v_slot.id and status = 'HELD' and expires_at > v_now) then return jsonb_build_object('ok', false, 'code', 'SLOT_ALREADY_HELD'); end if;

  insert into public.slot_holds(id, workspace_id, slot_id, quote_id, status, expires_at, idempotency_key, created_at, updated_at)
  values (coalesce(nullif(p_input->>'holdId','')::uuid, gen_random_uuid()), v_workspace, v_slot.id, v_quote.id, 'HELD', v_now + interval '15 minutes', v_idempotency, v_now, v_now)
  returning * into v_hold;
  return jsonb_build_object('ok', true, 'duplicate', false, 'hold', public.servicedesk_hold_json(v_hold));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'SLOT_ALREADY_HELD');
end;
$$;

create or replace function public.servicedesk_find_capacity_slots(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_from timestamptz := (p_input->>'from')::timestamptz;
  v_to timestamptz := (p_input->>'to')::timestamptz;
begin
  return jsonb_build_object('ok', true, 'slots', coalesce((
    select jsonb_agg(public.servicedesk_slot_json(s) order by s.starts_at)
    from public.capacity_slots s
    where s.workspace_id = v_workspace
      and s.starts_at >= v_from
      and s.ends_at <= v_to
      and (nullif(p_input->>'preferredCrewId','') is null or s.crew_id = (p_input->>'preferredCrewId')::uuid)
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.servicedesk_require_staff(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.servicedesk_request_json(public.requests) from public, anon, authenticated;
revoke all on function public.servicedesk_quote_json(public.quotes) from public, anon, authenticated;
revoke all on function public.servicedesk_slot_json(public.capacity_slots) from public, anon, authenticated;
revoke all on function public.servicedesk_hold_json(public.slot_holds) from public, anon, authenticated;

revoke all on function public.servicedesk_create_customer(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_create_property(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_create_request(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_update_request(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_persist_quote_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_send_quote(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_accept_quote(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_upsert_capacity_slot(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_hold_slot(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_find_capacity_slots(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_create_customer(jsonb) to service_role;
grant execute on function public.servicedesk_create_property(jsonb) to service_role;
grant execute on function public.servicedesk_create_request(jsonb) to service_role;
grant execute on function public.servicedesk_update_request(jsonb) to service_role;
grant execute on function public.servicedesk_persist_quote_snapshot(jsonb) to service_role;
grant execute on function public.servicedesk_send_quote(jsonb) to service_role;
grant execute on function public.servicedesk_accept_quote(jsonb) to service_role;
grant execute on function public.servicedesk_upsert_capacity_slot(jsonb) to service_role;
grant execute on function public.servicedesk_hold_slot(jsonb) to service_role;
grant execute on function public.servicedesk_find_capacity_slots(jsonb) to service_role;
