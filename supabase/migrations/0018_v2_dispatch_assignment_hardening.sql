-- ServiceDesk AI V2: dispatcher assignment concurrency/idempotency hardening
-- Adds an atomic staff-only assignment command used by human-approved dispatch suggestions.

create or replace function public.servicedesk_assign_visit_crew(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_visit_id uuid := nullif(p_input->>'visitId','')::uuid;
  v_crew_id uuid := nullif(p_input->>'crewId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_visit public.visits%rowtype;
  v_quote public.quotes%rowtype;
  v_crew public.crews%rowtype;
begin
  if v_workspace is null
     or v_actor_role is null
     or v_actor_user is null
     or v_visit_id is null
     or v_crew_id is null
     or v_expected is null
     or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'DISPATCH_ASSIGNMENT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Serialize the same logical command so repeated submits converge on one idempotency record.
  perform pg_advisory_xact_lock(
    hashtext(v_workspace::text),
    hashtext('visit.assign_crew:' || v_idempotency)
  );

  select * into v_existing
  from public.servicedesk_command_idempotency
  where workspace_id = v_workspace
    and command_scope = 'assign_visit_crew'
    and idempotency_key = v_idempotency;

  if found then
    if v_existing.resource_id <> v_visit_id then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    select * into v_visit
    from public.visits
    where workspace_id = v_workspace and id = v_visit_id;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND');
    end if;
    if v_visit.crew_id is distinct from v_crew_id then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    select * into v_quote
    from public.quotes
    where workspace_id = v_workspace and id = v_visit.quote_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'visit', jsonb_build_object(
        'id', v_visit.id,
        'workspaceId', v_visit.workspace_id,
        'requestId', v_visit.request_id,
        'quoteId', v_visit.quote_id,
        'crewId', v_visit.crew_id,
        'status', case
          when v_visit.status = 'SCHEDULED' then 'CONFIRMED'
          when v_visit.status = 'NEEDS_REVIEW' then 'PENDING_REVIEW'
          else v_visit.status::text
        end,
        'startAt', v_visit.starts_at,
        'serviceMinutes', coalesce(
          v_quote.duration_minutes,
          greatest(0, floor(extract(epoch from (v_visit.ends_at - v_visit.starts_at)) / 60)::int)
        ),
        'bufferMinutes', coalesce(v_quote.buffer_minutes, 0),
        'version', v_visit.version
      )
    );
  end if;

  select * into v_visit
  from public.visits
  where workspace_id = v_workspace and id = v_visit_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND');
  end if;

  if v_visit.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  if v_visit.status not in ('SCHEDULED','ASSIGNED') then
    return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID');
  end if;

  select * into v_crew
  from public.crews
  where workspace_id = v_workspace and id = v_crew_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CREW_NOT_AVAILABLE');
  end if;

  if not v_crew.active then
    return jsonb_build_object('ok', false, 'code', 'CREW_NOT_AVAILABLE');
  end if;

  -- Serialize assignments for one crew so two concurrent approvals cannot both pass the overlap check.
  perform pg_advisory_xact_lock(hashtext(v_workspace::text), hashtext(v_crew_id::text));

  if exists (
    select 1
    from public.visits other
    where other.workspace_id = v_workspace
      and other.id <> v_visit.id
      and other.crew_id = v_crew_id
      and other.status not in ('CANCELLED','COMPLETED')
      and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(v_visit.starts_at, v_visit.ends_at, '[)')
  ) then
    return jsonb_build_object('ok', false, 'code', 'CREW_SCHEDULE_CONFLICT');
  end if;

  if v_visit.crew_id is distinct from v_crew_id or v_visit.status <> 'ASSIGNED' then
    update public.visits
    set crew_id = v_crew_id,
        status = 'ASSIGNED',
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace and id = v_visit.id
    returning * into v_visit;
  end if;

  insert into public.servicedesk_command_idempotency(
    workspace_id,
    command_scope,
    idempotency_key,
    resource_type,
    resource_id
  )
  values (
    v_workspace,
    'assign_visit_crew',
    v_idempotency,
    'visit',
    v_visit.id
  );

  insert into public.outbox_events(
    id,
    workspace_id,
    topic,
    payload,
    status,
    attempts,
    idempotency_key,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_workspace,
    'calendar.visit.upsert',
    jsonb_build_object(
      'visitId', v_visit.id,
      'requestId', v_visit.request_id,
      'quoteId', v_visit.quote_id,
      'crewId', v_visit.crew_id,
      'startsAt', v_visit.starts_at,
      'endsAt', v_visit.ends_at,
      'timezone', v_visit.timezone,
      'status', v_visit.status
    ),
    'PENDING',
    0,
    'calendar.visit.upsert:' || v_visit.id::text || ':assign:' || v_visit.version::text,
    v_now,
    v_now
  )
  on conflict (workspace_id, idempotency_key) do nothing;

  select * into v_quote
  from public.quotes
  where workspace_id = v_workspace and id = v_visit.quote_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'visit', jsonb_build_object(
      'id', v_visit.id,
      'workspaceId', v_visit.workspace_id,
      'requestId', v_visit.request_id,
      'quoteId', v_visit.quote_id,
      'crewId', v_visit.crew_id,
      'status', case
        when v_visit.status = 'SCHEDULED' then 'CONFIRMED'
        when v_visit.status = 'NEEDS_REVIEW' then 'PENDING_REVIEW'
        else v_visit.status::text
      end,
      'startAt', v_visit.starts_at,
      'serviceMinutes', coalesce(
        v_quote.duration_minutes,
        greatest(0, floor(extract(epoch from (v_visit.ends_at - v_visit.starts_at)) / 60)::int)
      ),
      'bufferMinutes', coalesce(v_quote.buffer_minutes, 0),
      'version', v_visit.version
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_assign_visit_crew(jsonb) from public;
revoke all on function public.servicedesk_assign_visit_crew(jsonb) from anon;
revoke all on function public.servicedesk_assign_visit_crew(jsonb) from authenticated;
grant execute on function public.servicedesk_assign_visit_crew(jsonb) to service_role;

comment on function public.servicedesk_assign_visit_crew(jsonb) is
  'Trusted service-role dispatcher crew assignment RPC with actor/workspace checks, expected-version concurrency, active-crew validation, overlap protection, idempotency, and calendar projection.';
