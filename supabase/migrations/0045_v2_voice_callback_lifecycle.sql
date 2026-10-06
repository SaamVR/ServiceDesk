-- ServiceDesk AI V2 Wave 2C.1B: missed-call callback lifecycle.
-- Callback completion is an operational staff task only. It does not identify the caller,
-- change quote/payment authority, or add recording/transcription scope.

alter table public.voice_call_intakes
  add column if not exists version bigint not null default 1 check (version > 0);

alter table public.voice_call_intakes
  add column if not exists resolved_at timestamptz;

alter table public.voice_call_intakes
  add column if not exists resolved_by_user_id uuid references auth.users(id) on delete set null;

alter table public.voice_call_intakes
  drop constraint if exists voice_call_intakes_resolution_state_ck;

alter table public.voice_call_intakes
  add constraint voice_call_intakes_resolution_state_ck
  check (
    (callback_state = 'PENDING' and resolved_at is null)
    or
    (callback_state = 'RESOLVED' and resolved_at is not null)
  );

create or replace function public.servicedesk_set_voice_callback_state(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_intake_id uuid := nullif(p_input->>'intakeId','')::uuid;
  v_state text := p_input->>'state';
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_intake public.voice_call_intakes%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_intake_id is null or v_state not in ('PENDING','RESOLVED') then
    return jsonb_build_object('ok', false, 'code', 'VOICE_CALLBACK_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_intake
  from public.voice_call_intakes
  where workspace_id = v_workspace and id = v_intake_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'VOICE_CALLBACK_NOT_FOUND');
  end if;

  if v_intake.request_id is null then
    return jsonb_build_object('ok', false, 'code', 'VOICE_CALLBACK_REQUEST_NOT_LINKED');
  end if;

  if v_intake.callback_state = v_state then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'intakeId', v_intake.id,
      'requestId', v_intake.request_id,
      'callbackState', v_intake.callback_state,
      'version', v_intake.version
    );
  end if;

  update public.voice_call_intakes
  set callback_state = v_state,
      resolved_at = case when v_state = 'RESOLVED' then v_now else null end,
      resolved_by_user_id = case when v_state = 'RESOLVED' then v_actor_user else null end,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_intake_id
  returning * into v_intake;

  update public.requests
  set structured_fields = structured_fields || jsonb_build_object(
        'callbackRequired', v_state = 'PENDING',
        'callbackState', v_state
      ),
      updated_at = v_now
  where workspace_id = v_workspace and id = v_intake.request_id;

  if v_state = 'RESOLVED' then
    update public.attention_items
    set status = 'RESOLVED',
        updated_at = v_now
    where workspace_id = v_workspace
      and type = 'VOICE_CALLBACK'
      and resource_type = 'request'
      and resource_id = v_intake.request_id
      and status = 'OPEN';
  else
    insert into public.attention_items(
      workspace_id, type, resource_type, resource_id, severity, status, summary, created_at, updated_at
    ) values (
      v_workspace, 'VOICE_CALLBACK', 'request', v_intake.request_id,
      'WARNING', 'OPEN', 'Missed call requires staff callback.', v_now, v_now
    )
    on conflict (workspace_id, type, resource_type, resource_id) where status = 'OPEN'
    do update set severity = excluded.severity, summary = excluded.summary, updated_at = excluded.updated_at;
  end if;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    case when v_state = 'RESOLVED' then 'VOICE_CALLBACK_RESOLVED' else 'VOICE_CALLBACK_REOPENED' end,
    'voice_call_intake',
    v_intake.id,
    jsonb_build_object(
      'requestId', v_intake.request_id,
      'callbackState', v_intake.callback_state,
      'version', v_intake.version
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'intakeId', v_intake.id,
    'requestId', v_intake.request_id,
    'callbackState', v_intake.callback_state,
    'version', v_intake.version
  );
end;
$$;

revoke all on function public.servicedesk_set_voice_callback_state(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_set_voice_callback_state(jsonb) to service_role;

comment on function public.servicedesk_set_voice_callback_state(jsonb) is
  'Owner/dispatcher callback-task lifecycle for missed calls. Audit metadata excludes caller reference.';
