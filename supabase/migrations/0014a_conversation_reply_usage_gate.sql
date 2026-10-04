-- ServiceDesk AI V1 INT9: integrate OUTBOUND_MESSAGES usage into authoritative reply RPC.

create or replace function public.servicedesk_enqueue_conversation_reply(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_conversation_id uuid := (p_input->>'conversationId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_idempotency_key text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_channel text := p_input->>'channel';
  v_body text := nullif(trim(p_input->>'body'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_conversation public.conversations%rowtype;
  v_message public.messages%rowtype;
  v_outbox public.outbox_events%rowtype;
  v_customer_id uuid;
  v_recipient text;
  v_consent text;
  v_usage jsonb;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null or v_conversation_id is null
     or v_expected is null or v_idempotency_key is null or v_channel is null or v_body is null then
    return jsonb_build_object('ok', false, 'code', 'REPLY_INPUT_INVALID');
  end if;
  if v_channel not in ('WHATSAPP','EMAIL') then return jsonb_build_object('ok', false, 'code', 'REPLY_CHANNEL_UNSUPPORTED'); end if;
  if length(v_body) > 4000 then return jsonb_build_object('ok', false, 'code', 'REPLY_BODY_TOO_LONG'); end if;

  if not (v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  )) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_message
  from public.messages
  where workspace_id = v_workspace and outbound_idempotency_key = v_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', true, 'duplicate', true,
      'message', jsonb_build_object(
        'id', v_message.id, 'workspaceId', v_message.workspace_id, 'conversationId', v_message.conversation_id,
        'direction', v_message.direction, 'senderKind', v_message.sender_kind, 'body', v_message.body,
        'deliveryState', v_message.delivery_state, 'createdAt', v_message.created_at
      ),
      'outboxEventId', v_message.outbox_event_id
    );
  end if;

  select * into v_conversation
  from public.conversations
  where workspace_id = v_workspace and id = v_conversation_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'CONVERSATION_NOT_FOUND'); end if;
  if v_conversation.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;
  if v_conversation.channel <> v_channel then return jsonb_build_object('ok', false, 'code', 'REPLY_CHANNEL_MISMATCH'); end if;
  if v_conversation.customer_id is null then return jsonb_build_object('ok', false, 'code', 'CUSTOMER_REQUIRED'); end if;
  v_customer_id := v_conversation.customer_id;

  if v_channel = 'WHATSAPP' then
    select value into v_recipient
    from public.customer_contacts
    where workspace_id = v_workspace and customer_id = v_customer_id and kind = 'PHONE'
    order by is_primary desc, created_at asc
    limit 1;
  else
    select value into v_recipient
    from public.customer_contacts
    where workspace_id = v_workspace and customer_id = v_customer_id and kind = 'EMAIL'
    order by is_primary desc, created_at asc
    limit 1;
  end if;
  if v_recipient is null then return jsonb_build_object('ok', false, 'code', 'RECIPIENT_NOT_FOUND'); end if;

  select status into v_consent
  from public.communication_consents
  where workspace_id = v_workspace and customer_id = v_customer_id and channel = v_channel
  order by recorded_at desc, created_at desc
  limit 1;
  if coalesce(v_consent, 'UNKNOWN') <> 'GRANTED' then
    return jsonb_build_object('ok', false, 'code', 'CONSENT_NOT_GRANTED');
  end if;

  v_usage := public.servicedesk_consume_usage(jsonb_build_object(
    'workspaceId', v_workspace,
    'metric', 'OUTBOUND_MESSAGES',
    'requested', 1,
    'now', v_now
  ));
  if coalesce((v_usage->>'ok')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'code', coalesce(v_usage->>'code', 'USAGE_CONSUME_FAILED'));
  end if;

  insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
  values (
    gen_random_uuid(), v_workspace, 'conversation.reply',
    jsonb_build_object('conversationId', v_conversation.id, 'channel', v_channel, 'recipient', v_recipient, 'body', v_body),
    'PENDING', 0, 'conversation.reply:' || v_workspace::text || ':' || v_idempotency_key, v_now, v_now
  ) returning * into v_outbox;

  insert into public.messages(
    id, workspace_id, conversation_id, direction, sender_kind, body, outbound_idempotency_key, outbox_event_id, delivery_state, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_conversation.id, 'OUTBOUND', 'STAFF', v_body, v_idempotency_key, v_outbox.id, 'QUEUED', v_now
  ) returning * into v_message;

  update public.conversations
  set version = version + 1,
      last_message_at = v_now,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_conversation.id;

  return jsonb_build_object(
    'ok', true, 'duplicate', false,
    'message', jsonb_build_object(
      'id', v_message.id, 'workspaceId', v_message.workspace_id, 'conversationId', v_message.conversation_id,
      'direction', v_message.direction, 'senderKind', v_message.sender_kind, 'body', v_message.body,
      'deliveryState', v_message.delivery_state, 'createdAt', v_message.created_at
    ),
    'outboxEventId', v_outbox.id
  );
end;
$$;

revoke execute on function public.servicedesk_enqueue_conversation_reply(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_enqueue_conversation_reply(jsonb) to service_role;
