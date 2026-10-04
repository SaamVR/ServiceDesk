-- ServiceDesk AI V1 INT6 / E06: core field runtime, evidence, checklist and visit transition RPCs

create table if not exists public.visit_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visit_id uuid not null,
  kind text not null check (kind in ('BEFORE_PHOTO','AFTER_PHOTO','ISSUE_PHOTO','TIME_MATERIAL_NOTE','INCIDENT_NOTE')),
  media_reference jsonb,
  text text,
  captured_at timestamptz not null,
  submitted_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, visit_id) references public.visits(workspace_id, id) on delete cascade,
  check (
    (kind in ('BEFORE_PHOTO','AFTER_PHOTO','ISSUE_PHOTO') and media_reference is not null and text is null)
    or
    (kind in ('TIME_MATERIAL_NOTE','INCIDENT_NOTE') and media_reference is null and text is not null and length(trim(text)) > 0)
  )
);

create table if not exists public.visit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visit_id uuid not null,
  item_key text not null check (length(trim(item_key)) > 0),
  completed boolean not null default false,
  note text,
  updated_by_user_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  unique (workspace_id, visit_id, item_key),
  foreign key (workspace_id, visit_id) references public.visits(workspace_id, id) on delete cascade
);

create index if not exists visit_evidence_visit_kind_idx
  on public.visit_evidence(workspace_id, visit_id, kind, captured_at desc);
create index if not exists visit_checklist_visit_idx
  on public.visit_checklist_items(workspace_id, visit_id, item_key);

alter table public.visit_evidence enable row level security;
alter table public.visit_checklist_items enable row level security;

drop policy if exists visit_evidence_staff_select on public.visit_evidence;
create policy visit_evidence_staff_select on public.visit_evidence
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists visit_evidence_crew_select on public.visit_evidence;
create policy visit_evidence_crew_select on public.visit_evidence
for select to authenticated
using (
  exists (
    select 1
    from public.visits v
    join public.crew_members cm on cm.workspace_id = v.workspace_id and cm.crew_id = v.crew_id
    where v.workspace_id = visit_evidence.workspace_id
      and v.id = visit_evidence.visit_id
      and cm.user_id = auth.uid()
      and cm.active = true
  )
);

drop policy if exists visit_checklist_staff_select on public.visit_checklist_items;
create policy visit_checklist_staff_select on public.visit_checklist_items
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists visit_checklist_crew_select on public.visit_checklist_items;
create policy visit_checklist_crew_select on public.visit_checklist_items
for select to authenticated
using (
  exists (
    select 1
    from public.visits v
    join public.crew_members cm on cm.workspace_id = v.workspace_id and cm.crew_id = v.crew_id
    where v.workspace_id = visit_checklist_items.workspace_id
      and v.id = visit_checklist_items.visit_id
      and cm.user_id = auth.uid()
      and cm.active = true
  )
);

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

create or replace function public.servicedesk_add_visit_evidence(p_input jsonb)
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
  v_kind text := p_input->>'kind';
  v_media jsonb := p_input->'mediaReference';
  v_text text := nullif(trim(p_input->>'text'), '');
  v_captured timestamptz := (p_input->>'capturedAt')::timestamptz;
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_visit public.visits%rowtype;
  v_staff boolean;
  v_assigned_crew boolean;
  v_evidence public.visit_evidence%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_visit_id is null or v_kind is null or v_captured is null then
    return jsonb_build_object('ok', false, 'code', 'VISIT_EVIDENCE_INVALID');
  end if;

  select * into v_visit from public.visits where workspace_id = v_workspace and id = v_visit_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND'); end if;

  v_staff := v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  );
  v_assigned_crew := exists (
    select 1 from public.crew_members where workspace_id = v_workspace and crew_id = v_visit.crew_id and user_id = v_actor_user and active = true
  );
  if not (v_staff or v_assigned_crew) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;

  if v_kind in ('BEFORE_PHOTO','AFTER_PHOTO','ISSUE_PHOTO') and v_media is null then
    return jsonb_build_object('ok', false, 'code', 'VISIT_EVIDENCE_MEDIA_REQUIRED');
  end if;
  if v_kind in ('TIME_MATERIAL_NOTE','INCIDENT_NOTE') and v_text is null then
    return jsonb_build_object('ok', false, 'code', 'VISIT_EVIDENCE_TEXT_REQUIRED');
  end if;
  if v_kind not in ('BEFORE_PHOTO','AFTER_PHOTO','ISSUE_PHOTO','TIME_MATERIAL_NOTE','INCIDENT_NOTE') then
    return jsonb_build_object('ok', false, 'code', 'VISIT_EVIDENCE_KIND_UNSUPPORTED');
  end if;

  insert into public.visit_evidence(id, workspace_id, visit_id, kind, media_reference, text, captured_at, submitted_by_user_id, created_at)
  values (gen_random_uuid(), v_workspace, v_visit.id, v_kind, case when v_kind like '%PHOTO' then v_media else null end, case when v_kind like '%NOTE' then v_text else null end, v_captured, v_actor_user, v_now)
  returning * into v_evidence;

  if v_kind = 'INCIDENT_NOTE' then
    insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
    values (gen_random_uuid(), v_workspace, 'FIELD_INCIDENT', 'visit', v_visit.id, 'WARNING', 'OPEN', 'Crew reported a field incident.', v_now)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'evidence', jsonb_build_object(
      'id', v_evidence.id, 'workspaceId', v_evidence.workspace_id, 'visitId', v_evidence.visit_id,
      'kind', v_evidence.kind, 'mediaReference', v_evidence.media_reference, 'text', v_evidence.text,
      'capturedAt', v_evidence.captured_at, 'submittedByUserId', v_evidence.submitted_by_user_id, 'createdAt', v_evidence.created_at
    )
  );
end;
$$;

create or replace function public.servicedesk_set_visit_checklist_item(p_input jsonb)
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
  v_item_key text := nullif(trim(p_input->>'itemKey'), '');
  v_completed boolean := coalesce((p_input->>'completed')::boolean, false);
  v_note text := nullif(trim(p_input->>'note'), '');
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_visit public.visits%rowtype;
  v_staff boolean;
  v_assigned_crew boolean;
  v_item public.visit_checklist_items%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_visit_id is null or v_item_key is null then
    return jsonb_build_object('ok', false, 'code', 'VISIT_CHECKLIST_INVALID');
  end if;

  select * into v_visit from public.visits where workspace_id = v_workspace and id = v_visit_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'VISIT_NOT_FOUND'); end if;

  v_staff := v_actor_role in ('OWNER','DISPATCHER') and exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  );
  v_assigned_crew := exists (
    select 1 from public.crew_members where workspace_id = v_workspace and crew_id = v_visit.crew_id and user_id = v_actor_user and active = true
  );
  if not (v_staff or v_assigned_crew) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;

  insert into public.visit_checklist_items(id, workspace_id, visit_id, item_key, completed, note, updated_by_user_id, updated_at, version)
  values (gen_random_uuid(), v_workspace, v_visit.id, v_item_key, v_completed, v_note, v_actor_user, v_now, 1)
  on conflict (workspace_id, visit_id, item_key)
  do update set completed = excluded.completed,
                note = excluded.note,
                updated_by_user_id = excluded.updated_by_user_id,
                updated_at = excluded.updated_at,
                version = public.visit_checklist_items.version + 1
  returning * into v_item;

  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object(
      'id', v_item.id, 'workspaceId', v_item.workspace_id, 'visitId', v_item.visit_id,
      'itemKey', v_item.item_key, 'completed', v_item.completed, 'note', v_item.note,
      'updatedByUserId', v_item.updated_by_user_id, 'updatedAt', v_item.updated_at, 'version', v_item.version
    )
  );
end;
$$;

revoke all on function public.servicedesk_transition_visit(jsonb) from public;
revoke all on function public.servicedesk_transition_visit(jsonb) from anon;
revoke all on function public.servicedesk_transition_visit(jsonb) from authenticated;
grant execute on function public.servicedesk_transition_visit(jsonb) to service_role;

revoke all on function public.servicedesk_add_visit_evidence(jsonb) from public;
revoke all on function public.servicedesk_add_visit_evidence(jsonb) from anon;
revoke all on function public.servicedesk_add_visit_evidence(jsonb) from authenticated;
grant execute on function public.servicedesk_add_visit_evidence(jsonb) to service_role;

revoke all on function public.servicedesk_set_visit_checklist_item(jsonb) from public;
revoke all on function public.servicedesk_set_visit_checklist_item(jsonb) from anon;
revoke all on function public.servicedesk_set_visit_checklist_item(jsonb) from authenticated;
grant execute on function public.servicedesk_set_visit_checklist_item(jsonb) to service_role;

comment on function public.servicedesk_transition_visit(jsonb) is 'Trusted service-role visit transition RPC with expected-version, staff/crew authority, evidence gate, and calendar outbox projection.';
comment on function public.servicedesk_add_visit_evidence(jsonb) is 'Trusted service-role visit evidence RPC storing references/notes only and deduplicating incident attention.';
comment on function public.servicedesk_set_visit_checklist_item(jsonb) is 'Trusted service-role visit checklist upsert RPC with crew/staff authority.';
