-- F26 review-only owner authorization lock candidate — NOT INSTALLED
-- Cloned solely from historical 0011 visit RPC Git blob 4a6d93d2b729be235490c1d39b86e7c6f97f41b2.
-- Requires the independent reviewed F26 active-crew BEFORE ASSIGNED trigger.
-- Replaces ONLY servicedesk_transition_visit(jsonb), retains SECURITY INVOKER,
-- versioned visit transition and existing calendar outbox. Does NOT execute
-- against any connected Supabase project without separate human DBA/owner
-- migration and deployment authorization; source-only, no default rollout.
-- Direct authenticated RPC calls must match auth.uid() for claimed actor.
-- The original migration and existing F26 crew-trigger source remain intact.

create or replace function public.servicedesk_transition_visit(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_visit_id uuid := (p_input->>'visitId')::uuid;
  v_action text := p_input->>'action';
  v_expected bigint := (p_input->>'expectedVersion')::bigint;
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_visit public.visits%rowtype;
  v_quote public.quotes%rowtype;
  v_staff boolean;
  v_assigned_crew boolean;
  v_before boolean;
  v_after boolean;
  v_new_status public.visit_status;
  v_outbox_topic text;
  v_outbox_key text;
begin
  if v_workspace is null or v_actor_role is null or v_actor_user is null or v_visit_id is null or v_action is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'VISIT_COMMAND_INVALID');
  end if;

  -- Defensive direct-PostgREST boundary: authenticated RPC callers may NOT
  -- spoof another staff member by supplying arbitrary actorUserId/actorRole.
  -- The signed-in JWT must match the claimed actor. Trusted service_role
  -- remains allowed but must validate the owner in its server action.
  if current_user = 'anon' then
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
  end if;
  if current_user = 'authenticated' and
     (auth.uid() is null or auth.uid() is distinct from v_actor_user) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
  end if;

  select * into v_visit from public.visits where workspace_id = v_workspace and id = v_visit_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND'); end if;
  if v_visit.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); end if;

  v_staff := v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships
    where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  );
  v_assigned_crew := exists (
    select 1 from public.crew_members
    where workspace_id = v_workspace and crew_id = v_visit.crew_id and user_id = v_actor_user and active = true
  );

  -- Existing v_staff EXISTS is an unlocked snapshot. On ASSIGN, acquire
  -- a real row lock on the claiming OWNER/DISPATCHER membership. If the
  -- administrator revokes or changes the role first, the lock waits and
  -- the updated row no longer qualifies; if ASSIGN locks first, revocation
  -- cannot commit before the visit and transactional outbox commit.
  if v_action = 'ASSIGN' then
    select true into v_staff from public.memberships staff
    where staff.workspace_id = v_workspace
      and staff.user_id = v_actor_user
      and staff.status = 'ACTIVE'
      and staff.role in ('OWNER','DISPATCHER')
      and v_actor_role in ('OWNER','DISPATCHER')
    for share of staff;
    v_staff := coalesce(v_staff,false);
  end if;


  if v_action in ('ASSIGN','COMPLETE','CANCEL','CONFIRM') then
    if not v_staff then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  elsif v_action in ('EN_ROUTE','START','SUBMIT_REVIEW') then
    if not (v_staff or v_assigned_crew) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  else
    return jsonb_build_object('ok', false, 'code', 'VISIT_ACTION_UNSUPPORTED');
  end if;

  if v_visit.status in ('COMPLETED','CANCELLED') then
    return jsonb_build_object('ok', false, 'code', 'VISIT_TERMINAL');
  end if;

  if v_action = 'CONFIRM' then
    if v_visit.status <> 'SCHEDULED' then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    v_new_status := 'SCHEDULED';
    v_outbox_topic := 'calendar.visit.upsert';
    v_outbox_key := 'calendar.visit.upsert:' || v_visit.id::text;
  elsif v_action = 'ASSIGN' then
    if v_visit.status <> 'SCHEDULED' or v_visit.crew_id is null then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    v_new_status := 'ASSIGNED';
    v_outbox_topic := 'calendar.visit.upsert';
    v_outbox_key := 'calendar.visit.upsert:' || v_visit.id::text || ':assigned';
  elsif v_action = 'EN_ROUTE' then
    if v_visit.status <> 'ASSIGNED' then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    v_new_status := 'EN_ROUTE';
  elsif v_action = 'START' then
    if v_visit.status <> 'EN_ROUTE' then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    v_new_status := 'IN_PROGRESS';
  elsif v_action = 'SUBMIT_REVIEW' then
    if v_visit.status <> 'IN_PROGRESS' then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    select exists(select 1 from public.visit_evidence where workspace_id = v_workspace and visit_id = v_visit.id and kind = 'BEFORE_PHOTO') into v_before;
    select exists(select 1 from public.visit_evidence where workspace_id = v_workspace and visit_id = v_visit.id and kind = 'AFTER_PHOTO') into v_after;
    if not (v_before and v_after) then return jsonb_build_object('ok', false, 'code', 'VISIT_REVIEW_EVIDENCE_REQUIRED'); end if;
    v_new_status := 'NEEDS_REVIEW';
  elsif v_action = 'COMPLETE' then
    if not v_staff then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
    if v_visit.status <> 'NEEDS_REVIEW' then return jsonb_build_object('ok', false, 'code', 'VISIT_STATE_INVALID'); end if;
    v_new_status := 'COMPLETED';
  elsif v_action = 'CANCEL' then
    v_new_status := 'CANCELLED';
    v_outbox_topic := 'calendar.visit.cancel';
    v_outbox_key := 'calendar.visit.cancel:' || v_visit.id::text;
  end if;

  update public.visits
  set status = v_new_status,
      version = version + case when status is distinct from v_new_status then 1 else 0 end,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_visit.id
  returning * into v_visit;

  if v_outbox_topic is not null then
    insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
    values (
      gen_random_uuid(), v_workspace, v_outbox_topic,
      jsonb_build_object('visitId', v_visit.id, 'requestId', v_visit.request_id, 'quoteId', v_visit.quote_id, 'startsAt', v_visit.starts_at, 'endsAt', v_visit.ends_at, 'timezone', v_visit.timezone, 'status', v_visit.status),
      'PENDING', 0, v_outbox_key, v_now, v_now
    ) on conflict (workspace_id, idempotency_key) do nothing;
  end if;

  select * into v_quote from public.quotes where workspace_id = v_visit.workspace_id and id = v_visit.quote_id;
  return jsonb_build_object(
    'ok', true,
    'visit', jsonb_build_object(
      'id', v_visit.id, 'workspaceId', v_visit.workspace_id, 'requestId', v_visit.request_id,
      'quoteId', v_visit.quote_id, 'crewId', v_visit.crew_id,
      'status', case v_visit.status when 'SCHEDULED' then 'CONFIRMED' when 'NEEDS_REVIEW' then 'PENDING_REVIEW' else v_visit.status::text end,
      'startAt', v_visit.starts_at, 'serviceMinutes', coalesce(v_quote.duration_minutes, greatest(0, floor(extract(epoch from (v_visit.ends_at - v_visit.starts_at)) / 60)::int)),
      'bufferMinutes', coalesce(v_quote.buffer_minutes, 0), 'version', v_visit.version
    )
  );
end;
$$;

-- Preserve the 0011 service-role-only RPC boundary even when existing ACLs drift.
-- JWT binding is defense-in-depth, NOT permission for direct PostgREST callers.
revoke all on function public.servicedesk_transition_visit(jsonb) from public;
revoke all on function public.servicedesk_transition_visit(jsonb) from anon;
revoke all on function public.servicedesk_transition_visit(jsonb) from authenticated;
grant execute on function public.servicedesk_transition_visit(jsonb) to service_role;
