-- ServiceDesk AI V2: privacy-safe inbound operations observability.
-- Returns aggregate channel health only. Sender refs, provider account ids,
-- raw event refs and message bodies are intentionally excluded.

create or replace function public.servicedesk_read_inbound_operations_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_hours integer := coalesce(nullif(p_input->>'windowHours','')::integer, 24);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_from timestamptz;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_OBSERVABILITY_INPUT_INVALID');
  end if;

  if v_hours < 1 or v_hours > 168 then
    return jsonb_build_object('ok', false, 'code', 'INBOUND_OBSERVABILITY_WINDOW_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_from := v_now - make_interval(hours => v_hours);

  return jsonb_build_object(
    'ok', true,
    'workspaceId', v_workspace,
    'windowHours', v_hours,
    'windowStartedAt', v_from,
    'generatedAt', v_now,
    'messageChannels', (
      select coalesce(jsonb_agg(channel_row order by channel_row->>'channel'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'channel', channel_name,
          'receivedCount', count(r.id),
          'appliedCount', count(r.id) filter (where r.state = 'APPLIED'),
          'duplicateCount', count(r.id) filter (where r.state = 'DUPLICATE'),
          'ignoredCount', count(r.id) filter (where r.state = 'IGNORED'),
          'unresolvedIdentityCount', count(distinct r.conversation_id) filter (
            where r.conversation_id is not null
              and exists (
                select 1
                from public.attention_items a
                where a.workspace_id = v_workspace
                  and a.type = 'INBOUND_IDENTITY'
                  and a.resource_type = 'conversation'
                  and a.resource_id = r.conversation_id
                  and a.status = 'OPEN'
              )
          ),
          'latestReceivedAt', max(r.received_at)
        ) as channel_row
        from (values ('EMAIL'), ('WHATSAPP')) as channels(channel_name)
        left join public.provider_inbound_receipts r
          on r.workspace_id = v_workspace
         and r.provider = channels.channel_name
         and r.received_at >= v_from
        group by channel_name
      ) message_rows
    ),
    'voice', (
      select jsonb_build_object(
        'capturedCount', count(v.id),
        'pendingCallbackCount', count(v.id) filter (where v.callback_state = 'PENDING'),
        'resolvedCallbackCount', count(v.id) filter (where v.callback_state = 'RESOLVED'),
        'latestOccurredAt', max(v.occurred_at)
      )
      from public.voice_call_intakes v
      where v.workspace_id = v_workspace
        and v.occurred_at >= v_from
    )
  );
end;
$$;

revoke all on function public.servicedesk_read_inbound_operations_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_read_inbound_operations_snapshot(jsonb) to service_role;

comment on function public.servicedesk_read_inbound_operations_snapshot(jsonb) is
  'Owner/dispatcher aggregate inbound health for WhatsApp, Email and missed-call Voice. Excludes sender refs, provider account ids, raw event refs and bodies.';
