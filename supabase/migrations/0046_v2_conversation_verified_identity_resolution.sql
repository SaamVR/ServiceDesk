-- ServiceDesk AI V2 Wave 2C.2C: deterministic verified-identity resolution.
-- Staff may request a re-check, but cannot choose an arbitrary customer.
-- The authoritative command derives sender identity from persisted inbound messages
-- and requires exactly one verified active channel contact match.

create or replace function public.servicedesk_resolve_conversation_verified_identity(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_conversation_id uuid := nullif(p_input->>'conversationId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_conv public.conversations%rowtype;
  v_sender_ref text;
  v_customer_id uuid;
  v_match_count integer;
  v_request_customer uuid;
begin
  if v_workspace is null
     or v_actor_user is null
     or v_actor_role is null
     or v_conversation_id is null
     or v_expected is null
  then
    return jsonb_build_object('ok', false, 'code', 'IDENTITY_RESOLUTION_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_conv
  from public.conversations
  where workspace_id = v_workspace and id = v_conversation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CONVERSATION_NOT_FOUND');
  end if;

  if v_conv.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  if v_conv.channel not in ('EMAIL','WHATSAPP') then
    return jsonb_build_object('ok', false, 'code', 'IDENTITY_CHANNEL_UNSUPPORTED');
  end if;

  if v_conv.customer_id is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'conversationId', v_conv.id,
      'customerId', v_conv.customer_id,
      'version', v_conv.version,
      'handoverActive', v_conv.handover_active
    );
  end if;

  select case
           when v_conv.channel = 'EMAIL' then lower(trim(m.sender_ref))
           else trim(m.sender_ref)
         end
  into v_sender_ref
  from public.messages m
  where m.workspace_id = v_workspace
    and m.conversation_id = v_conv.id
    and m.direction = 'INBOUND'
    and nullif(trim(m.sender_ref), '') is not null
  order by coalesce(m.provider_occurred_at, m.created_at) desc, m.created_at desc
  limit 1;

  if v_sender_ref is null then
    return jsonb_build_object('ok', false, 'code', 'IDENTITY_SENDER_REF_NOT_FOUND');
  end if;

  select count(*)
  into v_match_count
  from (
    select distinct cc.customer_id
    from public.customer_contacts cc
    join public.customers c
      on c.workspace_id = cc.workspace_id
     and c.id = cc.customer_id
    where cc.workspace_id = v_workspace
      and cc.verified_at is not null
      and c.archived_at is null
      and (
        (v_conv.channel = 'EMAIL'
          and cc.kind = 'EMAIL'
          and lower(trim(cc.value)) = v_sender_ref)
        or
        (v_conv.channel = 'WHATSAPP'
          and cc.kind = 'PHONE'
          and trim(cc.value) = v_sender_ref)
      )
  ) matches;

  if v_match_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'IDENTITY_VERIFIED_MATCH_NOT_FOUND');
  end if;

  if v_match_count > 1 then
    return jsonb_build_object('ok', false, 'code', 'IDENTITY_VERIFIED_MATCH_AMBIGUOUS');
  end if;

  select cc.customer_id
  into v_customer_id
  from public.customer_contacts cc
  join public.customers c
    on c.workspace_id = cc.workspace_id
   and c.id = cc.customer_id
  where cc.workspace_id = v_workspace
    and cc.verified_at is not null
    and c.archived_at is null
    and (
      (v_conv.channel = 'EMAIL'
        and cc.kind = 'EMAIL'
        and lower(trim(cc.value)) = v_sender_ref)
      or
      (v_conv.channel = 'WHATSAPP'
        and cc.kind = 'PHONE'
        and trim(cc.value) = v_sender_ref)
    )
  limit 1;

  if v_conv.request_id is not null then
    select customer_id into v_request_customer
    from public.requests
    where workspace_id = v_workspace and id = v_conv.request_id
    for update;

    if v_request_customer is not null and v_request_customer <> v_customer_id then
      return jsonb_build_object('ok', false, 'code', 'IDENTITY_REQUEST_CUSTOMER_CONFLICT');
    end if;
  end if;

  update public.conversations
  set customer_id = v_customer_id,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_conv.id
  returning * into v_conv;

  if v_conv.request_id is not null then
    update public.requests
    set customer_id = coalesce(customer_id, v_customer_id),
        updated_at = v_now
    where workspace_id = v_workspace and id = v_conv.request_id;
  end if;

  update public.attention_items
  set status = 'RESOLVED',
      updated_at = v_now
  where workspace_id = v_workspace
    and type = 'INBOUND_IDENTITY'
    and resource_type = 'conversation'
    and resource_id = v_conv.id
    and status = 'OPEN';

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'CONVERSATION_VERIFIED_IDENTITY_RESOLVED',
    'conversation',
    v_conv.id,
    jsonb_build_object(
      'customerId', v_customer_id,
      'channel', v_conv.channel,
      'version', v_conv.version,
      'handoverActive', v_conv.handover_active
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'conversationId', v_conv.id,
    'customerId', v_customer_id,
    'version', v_conv.version,
    'handoverActive', v_conv.handover_active
  );
end;
$$;

revoke all on function public.servicedesk_resolve_conversation_verified_identity(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_resolve_conversation_verified_identity(jsonb) to service_role;

comment on function public.servicedesk_resolve_conversation_verified_identity(jsonb) is
  'Re-checks a persisted inbound sender against verified active customer contacts. Staff cannot supply customer identity; ambiguous or missing matches fail closed.';
