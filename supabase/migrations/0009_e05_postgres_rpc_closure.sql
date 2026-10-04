-- ServiceDesk AI V1 E05: trusted Postgres RPC persistence boundary
-- Keeps authoritative conversation/receipt/message/outbox mutations in single PostgreSQL statements.

create or replace function public.servicedesk_apply_inbound_message(p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_event->>'workspaceId')::uuid;
  v_channel text := p_event->>'channel';
  v_account text := nullif(trim(p_event->>'providerAccountId'), '');
  v_message_id text := nullif(trim(p_event->>'providerMessageId'), '');
  v_receipt_key text := nullif(trim(p_event->>'receiptKey'), '');
  v_sender_ref text := nullif(trim(p_event->>'senderRef'), '');
  v_occurred timestamptz := (p_event->>'occurredAt')::timestamptz;
  v_kind text := p_event->>'contentKind';
  v_body text := nullif(trim(p_event->>'text'), '');
  v_media jsonb := p_event->'media';
  v_raw_ref text := nullif(trim(p_event->>'rawProviderEventRef'), '');
  v_thread text;
  v_conv public.conversations%rowtype;
  v_msg public.messages%rowtype;
  v_receipt public.provider_inbound_receipts%rowtype;
  v_customer_id uuid;
  v_request_id uuid;
  v_request_count integer;
begin
  if v_workspace is null
    or v_channel <> 'WHATSAPP'
    or v_account is null
    or v_message_id is null
    or v_receipt_key is null
    or v_sender_ref is null
    or v_occurred is null
    or v_raw_ref is null
    or v_kind not in ('TEXT','MEDIA_REFERENCE','UNSUPPORTED')
  then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_EVENT_INVALID');
  end if;

  if v_kind = 'TEXT' and v_body is null then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_TEXT_REQUIRED');
  end if;

  if v_kind = 'MEDIA_REFERENCE' and coalesce(v_media->>'providerMediaId', '') = '' then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_MEDIA_REF_REQUIRED');
  end if;

  select * into v_receipt
  from public.provider_inbound_receipts
  where workspace_id = v_workspace
    and provider = 'WHATSAPP'
    and provider_account_id = v_account
    and (provider_receipt_key = v_receipt_key or provider_message_id = v_message_id)
  order by created_at asc
  limit 1
  for update;

  if found then
    select * into v_conv
    from public.conversations
    where workspace_id = v_workspace and id = v_receipt.conversation_id;

    select * into v_msg
    from public.messages
    where workspace_id = v_workspace and id = v_receipt.message_id;

    return jsonb_build_object(
      'ok', true,
      'state', 'DUPLICATE',
      'conversation', case when v_conv.id is null then null else jsonb_build_object(
        'id', v_conv.id,
        'workspaceId', v_conv.workspace_id,
        'requestId', v_conv.request_id,
        'customerId', v_conv.customer_id,
        'channel', v_conv.channel,
        'assignedUserId', v_conv.assigned_user_id,
        'handoverActive', v_conv.handover_active,
        'version', v_conv.version,
        'lastMessageAt', v_conv.last_message_at
      ) end,
      'message', case when v_msg.id is null then null else jsonb_build_object(
        'id', v_msg.id,
        'workspaceId', v_msg.workspace_id,
        'conversationId', v_msg.conversation_id,
        'direction', v_msg.direction,
        'senderKind', v_msg.sender_kind,
        'providerMessageId', v_msg.provider_message_id,
        'body', v_msg.body,
        'mediaReference', v_msg.media_reference,
        'deliveryState', v_msg.delivery_state,
        'createdAt', v_msg.created_at
      ) end
    );
  end if;

  insert into public.provider_inbound_receipts(
    id, workspace_id, provider, provider_account_id, provider_message_id, provider_receipt_key,
    sender_ref, provider_occurred_at, raw_provider_event_ref, content_kind,
    received_at, state
  ) values (
    gen_random_uuid(), v_workspace, 'WHATSAPP', v_account, v_message_id, v_receipt_key,
    v_sender_ref, v_occurred, v_raw_ref, v_kind,
    now(), 'RECEIVED'
  )
  returning * into v_receipt;

  v_thread := 'WHATSAPP:' || v_account || ':' || v_sender_ref;

  select c.id into v_customer_id
  from public.customer_contacts cc
  join public.customers c on c.workspace_id = cc.workspace_id and c.id = cc.customer_id
  where cc.workspace_id = v_workspace
    and cc.kind = 'PHONE'
    and cc.value = v_sender_ref
    and c.archived_at is null
  order by cc.is_primary desc, cc.created_at asc
  limit 1;

  if v_customer_id is not null then
    select count(*) into v_request_count
    from public.requests
    where workspace_id = v_workspace
      and customer_id = v_customer_id
      and status in ('NEW','COLLECTING','READY','NEEDS_REVIEW','QUOTED');

    if v_request_count = 1 then
      select id into v_request_id
      from public.requests
      where workspace_id = v_workspace
        and customer_id = v_customer_id
        and status in ('NEW','COLLECTING','READY','NEEDS_REVIEW','QUOTED')
      order by created_at desc
      limit 1;
    end if;
  end if;

  select * into v_conv
  from public.conversations
  where workspace_id = v_workspace
    and channel = 'WHATSAPP'
    and provider_thread_id = v_thread
  for update;

  if not found then
    insert into public.conversations(
      id, workspace_id, request_id, customer_id, channel, provider_thread_id, provider_account_id,
      handover_active, handover_owner_revision, version, created_at, updated_at
    ) values (
      gen_random_uuid(), v_workspace, v_request_id, v_customer_id, 'WHATSAPP', v_thread, v_account,
      false, 0, 1, v_occurred, v_occurred
    )
    returning * into v_conv;
  end if;

  if v_kind = 'UNSUPPORTED' then
    update public.provider_inbound_receipts
    set conversation_id = v_conv.id,
        processed_at = now(),
        state = 'IGNORED'
    where id = v_receipt.id
    returning * into v_receipt;

    return jsonb_build_object(
      'ok', true,
      'state', 'IGNORED',
      'conversation', jsonb_build_object(
        'id', v_conv.id,
        'workspaceId', v_conv.workspace_id,
        'requestId', v_conv.request_id,
        'customerId', v_conv.customer_id,
        'channel', v_conv.channel,
        'assignedUserId', v_conv.assigned_user_id,
        'handoverActive', v_conv.handover_active,
        'version', v_conv.version,
        'lastMessageAt', v_conv.last_message_at
      ),
      'message', null
    );
  end if;

  insert into public.messages(
    id, workspace_id, conversation_id, direction, sender_kind,
    provider_message_id, provider_receipt_key, provider_account_id, provider_occurred_at,
    sender_ref, content_kind, body, media_reference, raw_provider_event_ref,
    delivery_state, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_conv.id, 'INBOUND', 'CUSTOMER',
    v_message_id, v_receipt_key, v_account, v_occurred,
    v_sender_ref, v_kind, v_body, case when v_kind = 'MEDIA_REFERENCE' then v_media else null end, v_raw_ref,
    'DELIVERED', v_occurred
  )
  returning * into v_msg;

  update public.conversations
  set version = version + 1,
      last_message_at = v_occurred,
      updated_at = now()
  where workspace_id = v_workspace and id = v_conv.id
  returning * into v_conv;

  update public.provider_inbound_receipts
  set conversation_id = v_conv.id,
      message_id = v_msg.id,
      processed_at = now(),
      state = 'APPLIED'
  where id = v_receipt.id
  returning * into v_receipt;

  return jsonb_build_object(
    'ok', true,
    'state', 'APPLIED',
    'conversation', jsonb_build_object(
      'id', v_conv.id,
      'workspaceId', v_conv.workspace_id,
      'requestId', v_conv.request_id,
      'customerId', v_conv.customer_id,
      'channel', v_conv.channel,
      'assignedUserId', v_conv.assigned_user_id,
      'handoverActive', v_conv.handover_active,
      'version', v_conv.version,
      'lastMessageAt', v_conv.last_message_at
    ),
    'message', jsonb_build_object(
      'id', v_msg.id,
      'workspaceId', v_msg.workspace_id,
      'conversationId', v_msg.conversation_id,
      'direction', v_msg.direction,
      'senderKind', v_msg.sender_kind,
      'providerMessageId', v_msg.provider_message_id,
      'body', v_msg.body,
      'mediaReference', v_msg.media_reference,
      'deliveryState', v_msg.delivery_state,
      'createdAt', v_msg.created_at
    )
  );
end;
$$;

create or replace function public.servicedesk_set_conversation_handover(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId', '')::uuid;
  v_conversation_id uuid := (p_input->>'conversationId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_active boolean := coalesce((p_input->>'active')::boolean, false);
  v_assigned uuid := nullif(p_input->>'assignedUserId', '')::uuid;
  v_current_assigned uuid;
  v_conv public.conversations%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace
      and user_id = v_actor_user
      and status = 'ACTIVE'
      and role in ('OWNER','DISPATCHER')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_active and v_assigned is null then
    v_assigned := v_actor_user;
  end if;

  if v_active and not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace
      and user_id = v_assigned
      and status = 'ACTIVE'
      and role in ('OWNER','DISPATCHER')
  ) then
    return jsonb_build_object('ok', false, 'code', 'HANDOVER_ASSIGNEE_FORBIDDEN');
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

  v_current_assigned := case when v_active then v_assigned else null end;

  if v_conv.handover_active is not distinct from v_active
     and v_conv.assigned_user_id is not distinct from v_current_assigned then
    return jsonb_build_object(
      'ok', true,
      'conversation', jsonb_build_object(
        'id', v_conv.id,
        'workspaceId', v_conv.workspace_id,
        'requestId', v_conv.request_id,
        'customerId', v_conv.customer_id,
        'channel', v_conv.channel,
        'assignedUserId', v_conv.assigned_user_id,
        'handoverActive', v_conv.handover_active,
        'version', v_conv.version,
        'lastMessageAt', v_conv.last_message_at
      )
    );
  end if;

  update public.conversations
  set handover_active = v_active,
      assigned_user_id = v_current_assigned,
      handover_owner_revision = handover_owner_revision + 1,
      version = version + 1,
      updated_at = now()
  where workspace_id = v_workspace and id = v_conversation_id
  returning * into v_conv;

  return jsonb_build_object(
    'ok', true,
    'conversation', jsonb_build_object(
      'id', v_conv.id,
      'workspaceId', v_conv.workspace_id,
      'requestId', v_conv.request_id,
      'customerId', v_conv.customer_id,
      'channel', v_conv.channel,
      'assignedUserId', v_conv.assigned_user_id,
      'handoverActive', v_conv.handover_active,
      'version', v_conv.version,
      'lastMessageAt', v_conv.last_message_at
    )
  );
end;
$$;

create or replace function public.servicedesk_enqueue_conversation_reply(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId', '')::uuid;
  v_conversation_id uuid := (p_input->>'conversationId')::uuid;
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_channel text := p_input->>'channel';
  v_body text := nullif(trim(p_input->>'body'), '');
  v_conv public.conversations%rowtype;
  v_contact public.customer_contacts%rowtype;
  v_consent_status text;
  v_msg public.messages%rowtype;
  v_outbox public.outbox_events%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_expected is null or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace
      and user_id = v_actor_user
      and status = 'ACTIVE'
      and role in ('OWNER','DISPATCHER')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_channel not in ('WHATSAPP','EMAIL') then
    return jsonb_build_object('ok', false, 'code', 'REPLY_CHANNEL_INVALID');
  end if;

  if v_body is null or length(v_body) > 4000 then
    return jsonb_build_object('ok', false, 'code', 'REPLY_BODY_INVALID');
  end if;

  select * into v_msg
  from public.messages
  where workspace_id = v_workspace
    and outbound_idempotency_key = v_idempotency
  limit 1;

  if found then
    select * into v_outbox
    from public.outbox_events
    where workspace_id = v_workspace and id = v_msg.outbox_event_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'outboxEventId', v_msg.outbox_event_id,
      'message', jsonb_build_object(
        'id', v_msg.id,
        'workspaceId', v_msg.workspace_id,
        'conversationId', v_msg.conversation_id,
        'direction', v_msg.direction,
        'senderKind', v_msg.sender_kind,
        'providerMessageId', v_msg.provider_message_id,
        'body', v_msg.body,
        'mediaReference', v_msg.media_reference,
        'deliveryState', v_msg.delivery_state,
        'createdAt', v_msg.created_at
      )
    );
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

  if v_conv.channel <> v_channel then
    return jsonb_build_object('ok', false, 'code', 'REPLY_CHANNEL_MISMATCH');
  end if;

  if v_conv.customer_id is null then
    return jsonb_build_object('ok', false, 'code', 'REPLY_CUSTOMER_REQUIRED');
  end if;

  select * into v_contact
  from public.customer_contacts
  where workspace_id = v_workspace
    and customer_id = v_conv.customer_id
    and ((v_channel = 'WHATSAPP' and kind = 'PHONE') or (v_channel = 'EMAIL' and kind = 'EMAIL'))
  order by is_primary desc, created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'REPLY_RECIPIENT_NOT_FOUND');
  end if;

  select status into v_consent_status
  from public.communication_consents
  where workspace_id = v_workspace
    and customer_id = v_conv.customer_id
    and channel = v_channel
  order by recorded_at desc, created_at desc
  limit 1;

  if coalesce(v_consent_status, 'UNKNOWN') <> 'GRANTED' then
    return jsonb_build_object('ok', false, 'code', 'REPLY_CONSENT_REQUIRED');
  end if;

  insert into public.outbox_events(
    id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at
  ) values (
    gen_random_uuid(), v_workspace, 'conversation.reply',
    jsonb_build_object('conversationId', v_conv.id, 'channel', v_channel, 'recipient', v_contact.value),
    'PENDING', 0, 'conversation.reply:' || v_workspace::text || ':' || v_idempotency, now(), now()
  )
  returning * into v_outbox;

  insert into public.messages(
    id, workspace_id, conversation_id, direction, sender_kind, body,
    outbound_idempotency_key, outbox_event_id, delivery_state, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_conv.id, 'OUTBOUND', 'STAFF', v_body,
    v_idempotency, v_outbox.id, 'QUEUED', now()
  )
  returning * into v_msg;

  update public.conversations
  set version = version + 1,
      last_message_at = v_msg.created_at,
      updated_at = now()
  where workspace_id = v_workspace and id = v_conv.id
  returning * into v_conv;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'outboxEventId', v_outbox.id,
    'message', jsonb_build_object(
      'id', v_msg.id,
      'workspaceId', v_msg.workspace_id,
      'conversationId', v_msg.conversation_id,
      'direction', v_msg.direction,
      'senderKind', v_msg.sender_kind,
      'providerMessageId', v_msg.provider_message_id,
      'body', v_msg.body,
      'mediaReference', v_msg.media_reference,
      'deliveryState', v_msg.delivery_state,
      'createdAt', v_msg.created_at
    )
  );
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
  v_actor_user uuid := nullif(p_input->>'actorUserId', '')::uuid;
  v_customer_filter uuid := nullif(p_input->>'customerId', '')::uuid;
  v_conversation_filter uuid := nullif(p_input->>'conversationId', '')::uuid;
  v_customer_id uuid;
begin
  if v_actor_role in ('OWNER','DISPATCHER') then
    if not exists (
      select 1 from public.memberships
      where workspace_id = v_workspace
        and user_id = v_actor_user
        and status = 'ACTIVE'
        and role in ('OWNER','DISPATCHER')
    ) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;

    return jsonb_build_object(
      'ok', true,
      'conversations', coalesce((
        select jsonb_agg(to_jsonb(c) order by coalesce(c.last_message_at, c.created_at) desc)
        from public.conversations c
        where c.workspace_id = v_workspace
          and (v_customer_filter is null or c.customer_id = v_customer_filter)
          and (v_conversation_filter is null or c.id = v_conversation_filter)
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(to_jsonb(m) order by m.created_at asc)
        from public.messages m
        join public.conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id
        where m.workspace_id = v_workspace
          and (v_customer_filter is null or c.customer_id = v_customer_filter)
          and (v_conversation_filter is null or c.id = v_conversation_filter)
      ), '[]'::jsonb)
    );
  elsif v_actor_role = 'CUSTOMER' then
    select id into v_customer_id
    from public.customers
    where workspace_id = v_workspace
      and auth_user_id = v_actor_user
      and archived_at is null
    limit 1;

    if v_customer_id is null then
      return jsonb_build_object('ok', false, 'code', 'CUSTOMER_SCOPE_REQUIRED');
    end if;

    if v_customer_filter is not null and v_customer_filter <> v_customer_id then
      return jsonb_build_object('ok', false, 'code', 'CUSTOMER_SCOPE_REQUIRED');
    end if;

    return jsonb_build_object(
      'ok', true,
      'conversations', coalesce((
        select jsonb_agg(to_jsonb(c) order by coalesce(c.last_message_at, c.created_at) desc)
        from public.conversations c
        where c.workspace_id = v_workspace
          and c.customer_id = v_customer_id
          and (v_conversation_filter is null or c.id = v_conversation_filter)
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(to_jsonb(m) order by m.created_at asc)
        from public.messages m
        join public.conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id
        where m.workspace_id = v_workspace
          and c.customer_id = v_customer_id
          and (v_conversation_filter is null or c.id = v_conversation_filter)
      ), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
end;
$$;

revoke execute on function public.servicedesk_apply_inbound_message(jsonb) from public;
revoke execute on function public.servicedesk_apply_inbound_message(jsonb) from anon;
revoke execute on function public.servicedesk_apply_inbound_message(jsonb) from authenticated;
grant execute on function public.servicedesk_apply_inbound_message(jsonb) to service_role;

revoke execute on function public.servicedesk_set_conversation_handover(jsonb) from public;
revoke execute on function public.servicedesk_set_conversation_handover(jsonb) from anon;
revoke execute on function public.servicedesk_set_conversation_handover(jsonb) from authenticated;
grant execute on function public.servicedesk_set_conversation_handover(jsonb) to service_role;

revoke execute on function public.servicedesk_enqueue_conversation_reply(jsonb) from public;
revoke execute on function public.servicedesk_enqueue_conversation_reply(jsonb) from anon;
revoke execute on function public.servicedesk_enqueue_conversation_reply(jsonb) from authenticated;
grant execute on function public.servicedesk_enqueue_conversation_reply(jsonb) to service_role;

revoke execute on function public.servicedesk_read_workspace_snapshot(jsonb) from public;
revoke execute on function public.servicedesk_read_workspace_snapshot(jsonb) from anon;
revoke execute on function public.servicedesk_read_workspace_snapshot(jsonb) from authenticated;
grant execute on function public.servicedesk_read_workspace_snapshot(jsonb) to service_role;
