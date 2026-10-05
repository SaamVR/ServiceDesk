-- ServiceDesk AI V2: customer self-service communication preferences
-- Records append-only consent history through a trusted service-role command.

create or replace function public.servicedesk_record_customer_consent(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_customer uuid := nullif(p_input->>'customerId','')::uuid;
  v_channel text := upper(trim(p_input->>'channel'));
  v_purpose text := trim(p_input->>'purpose');
  v_status text := upper(trim(p_input->>'status'));
  v_expected_consent uuid := nullif(p_input->>'expectedConsentId','')::uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_consent public.communication_consents%rowtype;
  v_previous public.communication_consents%rowtype;
begin
  if v_workspace is null
     or v_actor_role <> 'CUSTOMER'
     or v_actor_user is null
     or v_customer is null
     or v_idempotency is null
     or v_channel not in ('WHATSAPP','EMAIL','SMS')
     or v_purpose is null
     or length(v_purpose) = 0
     or length(v_purpose) > 120
     or v_status not in ('GRANTED','REVOKED')
     or v_expected_consent is null then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_CONSENT_INPUT_INVALID');
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.workspace_id = v_workspace
      and c.id = v_customer
      and c.auth_user_id = v_actor_user
      and c.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_SCOPE_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_workspace::text),
    hashtext('customer_consent:' || v_idempotency)
  );

  select * into v_existing
  from public.servicedesk_command_idempotency
  where workspace_id = v_workspace
    and command_scope = 'customer.consent.record'
    and idempotency_key = v_idempotency;

  if found then
    select * into v_consent
    from public.communication_consents
    where workspace_id = v_workspace
      and id = v_existing.resource_id;

    if not found
       or v_consent.customer_id <> v_customer
       or v_consent.channel <> v_channel
       or v_consent.purpose <> v_purpose
       or v_consent.status <> v_status then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'consent', jsonb_build_object(
        'id', v_consent.id,
        'workspaceId', v_consent.workspace_id,
        'customerId', v_consent.customer_id,
        'channel', v_consent.channel,
        'purpose', v_consent.purpose,
        'status', v_consent.status,
        'source', v_consent.source,
        'recordedAt', v_consent.recorded_at
      )
    );
  end if;

  select * into v_previous
  from public.communication_consents
  where workspace_id = v_workspace
    and customer_id = v_customer
    and channel = v_channel
    and purpose = v_purpose
  order by recorded_at desc, created_at desc
  limit 1;

  if not found or v_previous.id <> v_expected_consent then
    return jsonb_build_object('ok', false, 'code', 'CONSENT_VERSION_CONFLICT');
  end if;

  if v_previous.status = v_status then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'consent', jsonb_build_object(
        'id', v_previous.id,
        'workspaceId', v_previous.workspace_id,
        'customerId', v_previous.customer_id,
        'channel', v_previous.channel,
        'purpose', v_previous.purpose,
        'status', v_previous.status,
        'source', v_previous.source,
        'recordedAt', v_previous.recorded_at
      )
    );
  end if;

  insert into public.communication_consents(
    id,
    workspace_id,
    customer_id,
    channel,
    purpose,
    status,
    source,
    evidence,
    recorded_at,
    created_at
  ) values (
    gen_random_uuid(),
    v_workspace,
    v_customer,
    v_channel,
    v_purpose,
    v_status,
    'CUSTOMER_PORTAL',
    jsonb_build_object('method', 'SELF_SERVICE'),
    v_now,
    v_now
  )
  returning * into v_consent;

  insert into public.servicedesk_command_idempotency(
    workspace_id,
    command_scope,
    idempotency_key,
    resource_type,
    resource_id
  ) values (
    v_workspace,
    'customer.consent.record',
    v_idempotency,
    'communication_consent',
    v_consent.id
  );

  insert into public.audit_events(
    workspace_id,
    actor_user_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    request_id,
    before_data,
    after_data,
    created_at
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'customer.communication_preference.changed',
    'communication_consent',
    v_consent.id,
    v_idempotency,
    case when v_previous.id is null then null else jsonb_build_object(
      'channel', v_previous.channel,
      'purpose', v_previous.purpose,
      'status', v_previous.status,
      'recordedAt', v_previous.recorded_at
    ) end,
    jsonb_build_object(
      'channel', v_consent.channel,
      'purpose', v_consent.purpose,
      'status', v_consent.status,
      'recordedAt', v_consent.recorded_at
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'consent', jsonb_build_object(
      'id', v_consent.id,
      'workspaceId', v_consent.workspace_id,
      'customerId', v_consent.customer_id,
      'channel', v_consent.channel,
      'purpose', v_consent.purpose,
      'status', v_consent.status,
      'source', v_consent.source,
      'recordedAt', v_consent.recorded_at
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_record_customer_consent(jsonb) from public;
revoke all on function public.servicedesk_record_customer_consent(jsonb) from anon;
revoke all on function public.servicedesk_record_customer_consent(jsonb) from authenticated;
grant execute on function public.servicedesk_record_customer_consent(jsonb) to service_role;

comment on function public.servicedesk_record_customer_consent(jsonb) is
  'Trusted service-role customer self-service consent command. Verifies customer/workspace ownership, appends consent history, records audit evidence, and is idempotent.';