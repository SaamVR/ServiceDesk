-- ServiceDesk AI V2: basic public enquiry abuse protection
-- Limit repeated submissions per server-issued visitor session without storing IP addresses.

create or replace function public.servicedesk_create_public_enquiry(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_session text := nullif(trim(p_input->>'visitorSessionId'), '');
  v_name text := nullif(trim(p_input->>'displayName'), '');
  v_email text := nullif(lower(trim(p_input->>'email')), '');
  v_phone text := nullif(trim(p_input->>'phone'), '');
  v_service_code text := nullif(trim(p_input->>'serviceCode'), '');
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_preferred_date text := nullif(trim(p_input->>'preferredDate'), '');
  v_message text := nullif(trim(p_input->>'message'), '');
  v_bedrooms int := nullif(p_input->>'bedrooms','')::int;
  v_bathrooms int := nullif(p_input->>'bathrooms','')::int;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_service uuid;
  v_customer uuid;
  v_request public.requests%rowtype;
  v_conversation uuid;
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_fields jsonb := '{}'::jsonb;
begin
  if v_workspace is null
     or v_session is null
     or v_name is null
     or v_service_code is null
     or v_idempotency is null
     or (v_email is null and v_phone is null) then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_INPUT_INVALID');
  end if;

  if length(v_session) > 200
     or length(v_name) > 120
     or coalesce(length(v_email), 0) > 254
     or coalesce(length(v_phone), 0) > 40
     or coalesce(length(v_message), 0) > 2000
     or coalesce(length(v_preferred_date), 0) > 10 then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_INPUT_INVALID');
  end if;

  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_EMAIL_INVALID');
  end if;

  if v_preferred_date is not null and v_preferred_date !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_DATE_INVALID');
  end if;

  if v_bedrooms is not null and (v_bedrooms < 0 or v_bedrooms > 10) then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_ROOMS_INVALID');
  end if;
  if v_bathrooms is not null and (v_bathrooms < 0 or v_bathrooms > 10) then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_ROOMS_INVALID');
  end if;

  if not exists (select 1 from public.workspaces where id = v_workspace) then
    return jsonb_build_object('ok', false, 'code', 'WORKSPACE_NOT_FOUND');
  end if;

  select * into v_existing
  from public.servicedesk_command_idempotency
  where workspace_id = v_workspace
    and command_scope = 'public_enquiry.create'
    and idempotency_key = v_idempotency;

  if found then
    select * into v_request
    from public.requests
    where workspace_id = v_workspace
      and id = v_existing.resource_id;

    select id into v_conversation
    from public.conversations
    where workspace_id = v_workspace
      and request_id = v_request.id
    order by created_at asc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'requestId', v_request.id,
      'customerId', v_request.customer_id,
      'conversationId', v_conversation
    );
  end if;

  if (
    select count(*)
    from public.requests
    where workspace_id = v_workspace
      and visitor_session_id = v_session
      and created_at >= v_now - interval '1 hour'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_RATE_LIMITED');
  end if;

  select id into v_service
  from public.service_catalog
  where workspace_id = v_workspace
    and code = v_service_code
    and active = true;
  if v_service is null then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_NOT_FOUND');
  end if;

  insert into public.customers(
    id, workspace_id, display_name, lead_source, version, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_workspace, v_name, 'WEB_ENQUIRY', 1, v_now, v_now
  )
  returning id into v_customer;

  if v_email is not null then
    insert into public.customer_contacts(
      id, workspace_id, customer_id, kind, value, is_primary, is_billing, created_at
    )
    values (
      gen_random_uuid(), v_workspace, v_customer, 'EMAIL', v_email, true, false, v_now
    );
  end if;

  if v_phone is not null then
    insert into public.customer_contacts(
      id, workspace_id, customer_id, kind, value, is_primary, is_billing, created_at
    )
    values (
      gen_random_uuid(), v_workspace, v_customer, 'PHONE', v_phone, v_email is null, false, v_now
    );
  end if;

  if v_bedrooms is not null then
    v_fields := v_fields || jsonb_build_object('bedrooms', v_bedrooms);
  end if;
  if v_bathrooms is not null then
    v_fields := v_fields || jsonb_build_object('bathrooms', v_bathrooms);
  end if;
  if v_preferred_date is not null then
    v_fields := v_fields || jsonb_build_object('preferredDate', v_preferred_date);
  end if;
  v_fields := v_fields || jsonb_build_object('source', 'WEB_ENQUIRY');

  insert into public.requests(
    id, workspace_id, customer_id, service_id, visitor_session_id, status,
    bedrooms, bathrooms, structured_fields, version, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_workspace, v_customer, v_service, v_session, 'NEW',
    v_bedrooms, v_bathrooms, v_fields, 1, v_now, v_now
  )
  returning * into v_request;

  insert into public.conversations(
    id, workspace_id, request_id, customer_id, channel, handover_active,
    handover_owner_revision, version, last_message_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_workspace, v_request.id, v_customer, 'WEB', false,
    0, 1, case when v_message is null then null else v_now end, v_now, v_now
  )
  returning id into v_conversation;

  if v_message is not null then
    insert into public.messages(
      id, workspace_id, conversation_id, direction, sender_kind, body,
      content_kind, created_at
    )
    values (
      gen_random_uuid(), v_workspace, v_conversation, 'INBOUND', 'CUSTOMER',
      v_message, 'TEXT', v_now
    );
  end if;

  insert into public.servicedesk_command_idempotency(
    id, workspace_id, command_scope, idempotency_key, resource_type, resource_id, created_at
  )
  values (
    gen_random_uuid(), v_workspace, 'public_enquiry.create', v_idempotency, 'request', v_request.id, v_now
  );

  insert into public.audit_events(
    id, workspace_id, actor_role, action, resource_type, resource_id, after_data, created_at
  )
  values (
    gen_random_uuid(),
    v_workspace,
    'VISITOR',
    'PUBLIC_ENQUIRY_CREATED',
    'request',
    v_request.id,
    jsonb_build_object('serviceCode', v_service_code, 'channel', 'WEB'),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'requestId', v_request.id,
    'customerId', v_customer,
    'conversationId', v_conversation
  );
exception
  when foreign_key_violation or unique_violation or check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'PUBLIC_ENQUIRY_REJECTED');
end;
$$;

revoke all on function public.servicedesk_create_public_enquiry(jsonb) from public;
revoke all on function public.servicedesk_create_public_enquiry(jsonb) from anon;
revoke all on function public.servicedesk_create_public_enquiry(jsonb) from authenticated;
grant execute on function public.servicedesk_create_public_enquiry(jsonb) to service_role;
