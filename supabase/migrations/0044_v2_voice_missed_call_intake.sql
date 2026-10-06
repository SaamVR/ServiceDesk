-- ServiceDesk AI V2 Wave 2C.1A: provider-neutral missed-call intake.
-- This slice creates a durable anonymous lead + callback attention item only.
-- It does not record audio, store transcripts, or identify a customer solely from caller ID.

create table if not exists public.voice_call_intakes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_account_id text not null check (length(trim(provider_account_id)) between 1 and 160),
  provider_call_id text not null check (length(trim(provider_call_id)) between 1 and 240),
  caller_ref text not null check (length(trim(caller_ref)) between 3 and 160),
  occurred_at timestamptz not null,
  raw_provider_event_ref text not null check (length(trim(raw_provider_event_ref)) between 3 and 240),
  disposition text not null default 'MISSED' check (disposition = 'MISSED'),
  request_id uuid,
  callback_state text not null default 'PENDING' check (callback_state in ('PENDING','RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider_account_id, provider_call_id),
  foreign key (workspace_id, request_id)
    references public.requests(workspace_id, id) on delete restrict
);

create index if not exists voice_call_intakes_callback_idx
  on public.voice_call_intakes(workspace_id, callback_state, occurred_at desc);

alter table public.voice_call_intakes enable row level security;

create policy voice_call_intakes_staff_select on public.voice_call_intakes
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.voice_call_intakes from anon, authenticated;
grant select on table public.voice_call_intakes to authenticated;
grant all on table public.voice_call_intakes to service_role;

create or replace function public.servicedesk_apply_missed_voice_call(p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_event->>'workspaceId','')::uuid;
  v_account text := nullif(trim(p_event->>'providerAccountId'),'');
  v_call_id text := nullif(trim(p_event->>'providerCallId'),'');
  v_caller text := nullif(trim(p_event->>'callerRef'),'');
  v_occurred timestamptz := nullif(p_event->>'occurredAt','')::timestamptz;
  v_raw_ref text := nullif(trim(p_event->>'rawProviderEventRef'),'');
  v_now timestamptz := coalesce(nullif(p_event->>'receivedAt','')::timestamptz, now());
  v_intake public.voice_call_intakes%rowtype;
  v_request public.requests%rowtype;
begin
  if p_event ? 'transcript'
     or p_event ? 'recordingUrl'
     or p_event ? 'recordingReference'
     or p_event ? 'recordingConsent'
  then
    return jsonb_build_object('ok', false, 'code', 'VOICE_MEDIA_NOT_ALLOWED');
  end if;

  if v_workspace is null
     or v_account is null or length(v_account) > 160
     or v_call_id is null or length(v_call_id) > 240
     or v_caller is null or length(v_caller) not between 3 and 160
     or v_occurred is null
     or v_raw_ref is null or length(v_raw_ref) > 240
  then
    return jsonb_build_object('ok', false, 'code', 'VOICE_MISSED_CALL_INPUT_INVALID');
  end if;

  select * into v_intake
  from public.voice_call_intakes
  where workspace_id = v_workspace
    and provider_account_id = v_account
    and provider_call_id = v_call_id
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'intakeId', v_intake.id,
      'requestId', v_intake.request_id,
      'callbackState', v_intake.callback_state
    );
  end if;

  insert into public.voice_call_intakes(
    workspace_id, provider_account_id, provider_call_id, caller_ref,
    occurred_at, raw_provider_event_ref, disposition, callback_state,
    created_at, updated_at
  ) values (
    v_workspace, v_account, v_call_id, v_caller,
    v_occurred, v_raw_ref, 'MISSED', 'PENDING',
    v_now, v_now
  )
  on conflict (workspace_id, provider_account_id, provider_call_id) do nothing
  returning * into v_intake;

  if v_intake.id is null then
    select * into v_intake
    from public.voice_call_intakes
    where workspace_id = v_workspace
      and provider_account_id = v_account
      and provider_call_id = v_call_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'intakeId', v_intake.id,
      'requestId', v_intake.request_id,
      'callbackState', v_intake.callback_state
    );
  end if;

  insert into public.requests(
    workspace_id,
    visitor_session_id,
    status,
    structured_fields,
    version,
    created_at,
    updated_at
  ) values (
    v_workspace,
    'VOICE:' || v_intake.id::text,
    'NEW',
    jsonb_build_object(
      'sourceChannel', 'VOICE',
      'sourceKind', 'MISSED_CALL',
      'voiceCallIntakeId', v_intake.id,
      'callbackRequired', true,
      'callbackContactRef', v_caller
    ),
    1,
    v_now,
    v_now
  )
  returning * into v_request;

  update public.voice_call_intakes
  set request_id = v_request.id,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_intake.id
  returning * into v_intake;

  insert into public.attention_items(
    workspace_id, type, resource_type, resource_id, severity, status, summary, created_at, updated_at
  ) values (
    v_workspace, 'VOICE_CALLBACK', 'request', v_request.id,
    'WARNING', 'OPEN', 'Missed call requires staff callback.', v_now, v_now
  )
  on conflict (workspace_id, type, resource_type, resource_id) where status = 'OPEN'
  do update set summary = excluded.summary, updated_at = excluded.updated_at;

  insert into public.audit_events(
    workspace_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, 'SYSTEM', 'VOICE_MISSED_CALL_CAPTURED', 'voice_call_intake', v_intake.id,
    jsonb_build_object(
      'requestId', v_request.id,
      'disposition', 'MISSED',
      'callbackState', 'PENDING'
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'intakeId', v_intake.id,
    'requestId', v_request.id,
    'callbackState', v_intake.callback_state
  );
end;
$$;

revoke all on function public.servicedesk_apply_missed_voice_call(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_apply_missed_voice_call(jsonb) to service_role;

comment on table public.voice_call_intakes is
  'Provider-neutral missed-call intake. Caller reference is operational PII; transcripts and recordings are intentionally absent from this slice.';
comment on function public.servicedesk_apply_missed_voice_call(jsonb) is
  'Creates an anonymous NEW request and callback attention item for a missed call. Caller ID is never used to attach a customer account.';
