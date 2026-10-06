-- ServiceDesk AI V2 Wave 2C.2A: authoritative inbound Email text intake.
-- WhatsApp continues to use servicedesk_apply_inbound_message unchanged.
-- Email identity attaches to a customer only when exactly one verified active EMAIL contact matches.

create or replace function public.servicedesk_apply_inbound_email_message(p_event jsonb)
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
  v_sender_ref text := lower(nullif(trim(p_event->>'senderRef'), ''));
  v_occurred timestamptz := (p_event->>'occurredAt')::timestamptz;
  v_kind text := p_event->>'contentKind';
  v_body text := nullif(trim(p_event->>'text'), '');
  v_raw_ref text := nullif(trim(p_event->>'rawProviderEventRef'), '');
  v_thread text;
  v_conv public.conversations%rowtype;
  v_msg public.messages%rowtype;
  v_receipt public.provider_inbound_receipts%rowtype;
  v_customer_id uuid;
  v_request_id uuid;
  v_request_count integer;
  v_contact_count integer;
begin
  if v_workspace is null
    or v_channel <> 'EMAIL'
    or v_account is null
    or v_message_id is null
    or v_receipt_key is null
    or v_sender_ref is null
    or v_occurred is null
    or v_raw_ref is null
    or v_kind <> 'TEXT'
    or v_body is null
  then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_EMAIL_EVENT_INVALID');
  end if;

  select * into v_receipt
  from public.provider_inbound_receipts
  where workspace_id = v_workspace
    and provider = 'EMAIL'
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
    gen_random_uuid(), v_workspace, 'EMAIL', v_account, v_message_id, v_receipt_key,
    v_sender_ref, v_occurred, v_raw_ref, 'TEXT',
    now(), 'RECEIVED'
  )
  returning * into v_receipt;

  v_thread := 'EMAIL:' || v_account || ':' || v_sender_ref;

  select count(distinct cc.customer_id) into v_contact_count
  from public.customer_contacts cc
  join public.customers c
    on c.workspace_id = cc.workspace_id and c.id = cc.customer_id
  where cc.workspace_id = v_workspace
    and cc.kind = 'EMAIL'
    and lower(trim(cc.value)) = v_sender_ref
    and cc.verified_at is not null
    and c.archived_at is null;

  if v_contact_count = 1 then
    select cc.customer_id into v_customer_id
    from public.customer_contacts cc
    join public.customers c
      on c.workspace_id = cc.workspace_id and c.id = cc.customer_id
    where cc.workspace_id = v_workspace
      and cc.kind = 'EMAIL'
      and lower(trim(cc.value)) = v_sender_ref
      and cc.verified_at is not null
      and c.archived_at is null
    order by cc.is_primary desc, cc.created_at asc
    limit 1;
  end if;

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
    and channel = 'EMAIL'
    and provider_thread_id = v_thread
  for update;

  if not found then
    insert into public.conversations(
      id, workspace_id, request_id, customer_id, channel, provider_thread_id, provider_account_id,
      handover_active, handover_owner_revision, version, created_at, updated_at
    ) values (
      gen_random_uuid(), v_workspace, v_request_id, v_customer_id, 'EMAIL', v_thread, v_account,
      false, 0, 1, v_occurred, v_occurred
    )
    returning * into v_conv;
  end if;

  if v_contact_count > 1 then
    insert into public.attention_items(
      workspace_id, type, resource_type, resource_id, severity, status, summary, created_at, updated_at
    ) values (
      v_workspace, 'INBOUND_IDENTITY', 'conversation', v_conv.id,
      'WARNING', 'OPEN', 'Inbound email matches multiple verified customer contacts.', now(), now()
    )
    on conflict (workspace_id, type, resource_type, resource_id) where status = 'OPEN'
    do update set summary = excluded.summary, updated_at = excluded.updated_at;
  end if;

  insert into public.messages(
    id, workspace_id, conversation_id, direction, sender_kind,
    provider_message_id, provider_receipt_key, provider_account_id, provider_occurred_at,
    sender_ref, content_kind, body, media_reference, raw_provider_event_ref,
    delivery_state, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_conv.id, 'INBOUND', 'CUSTOMER',
    v_message_id, v_receipt_key, v_account, v_occurred,
    v_sender_ref, 'TEXT', v_body, null, v_raw_ref,
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
  where id = v_receipt.id;

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
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_EMAIL_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_apply_inbound_email_message(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_apply_inbound_email_message(jsonb) to service_role;
