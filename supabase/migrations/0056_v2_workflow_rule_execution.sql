-- ServiceDesk AI V2 Wave 2D.2: workflow evaluation, action execution and replay.
-- Executions are append-oriented and action-scoped. Replaying a failed action never
-- replays the originating booking/domain event. Preview mode cannot produce side effects.

create table if not exists public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  branch_id uuid not null,
  rule_id uuid not null,
  rule_version_id uuid not null,
  mode text not null check (mode in ('PREVIEW','LIVE')),
  event_type text not null,
  execution_key text not null check (length(trim(execution_key)) between 8 and 200),
  event_fingerprint text not null check (
    length(trim(event_fingerprint)) between 8 and 200
    and event_fingerprint !~ E'[\\r\\n]'
  ),
  event_snapshot jsonb not null,
  matched boolean not null,
  recursion_depth integer not null default 0 check (recursion_depth between 0 and 2),
  parent_execution_id uuid,
  state text not null check (
    state in ('PREVIEWED','SKIPPED','ACTIONS_PENDING','COMPLETED','PARTIAL_FAILED')
  ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, execution_key),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete restrict,
  foreign key (workspace_id, rule_id)
    references public.workflow_rules(workspace_id, id) on delete cascade,
  foreign key (workspace_id, rule_version_id)
    references public.workflow_rule_versions(workspace_id, id) on delete restrict,
  foreign key (workspace_id, parent_execution_id)
    references public.workflow_executions(workspace_id, id) on delete set null
);

create table if not exists public.workflow_action_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  branch_id uuid not null,
  execution_id uuid not null,
  action_index integer not null check (action_index between 0 and 4),
  attempt_number integer not null default 1 check (attempt_number between 1 and 5),
  action_type text not null check (
    action_type in ('CREATE_ATTENTION','SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
  ),
  action_snapshot jsonb not null,
  state text not null check (
    state in (
      'PREVIEW_ONLY',
      'PENDING',
      'APPROVAL_REQUIRED',
      'APPROVED',
      'SUCCEEDED',
      'FAILED',
      'SUPPRESSED'
    )
  ),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  outbox_event_id uuid,
  error_code text check (
    error_code is null
    or (length(trim(error_code)) between 2 and 100 and error_code ~ '^[A-Z0-9_:-]+$')
  ),
  replay_of_action_execution_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, execution_id, action_index, attempt_number),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete restrict,
  foreign key (workspace_id, execution_id)
    references public.workflow_executions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, outbox_event_id)
    references public.outbox_events(workspace_id, id) on delete set null,
  foreign key (workspace_id, replay_of_action_execution_id)
    references public.workflow_action_executions(workspace_id, id) on delete set null,
  check (
    (state in ('APPROVED','SUCCEEDED','FAILED','SUPPRESSED') and action_type in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
      and (state <> 'APPROVED' or (approved_by is not null and approved_at is not null)))
    or action_type = 'CREATE_ATTENTION'
    or state in ('PREVIEW_ONLY','APPROVAL_REQUIRED')
  )
);

create index if not exists workflow_executions_rule_idx
  on public.workflow_executions(workspace_id, branch_id, rule_id, created_at desc);
create index if not exists workflow_action_execution_state_idx
  on public.workflow_action_executions(workspace_id, branch_id, state, created_at desc);

alter table public.workflow_executions enable row level security;
alter table public.workflow_action_executions enable row level security;

revoke all on table public.workflow_executions from public, anon, authenticated;
revoke all on table public.workflow_action_executions from public, anon, authenticated;
grant select on table public.workflow_executions to authenticated;
grant select on table public.workflow_action_executions to authenticated;
grant select, insert, update, delete on table public.workflow_executions to service_role;
grant select, insert, update, delete on table public.workflow_action_executions to service_role;

drop policy if exists workflow_executions_staff_select on public.workflow_executions;
create policy workflow_executions_staff_select
on public.workflow_executions
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);

drop policy if exists workflow_action_executions_staff_select on public.workflow_action_executions;
create policy workflow_action_executions_staff_select
on public.workflow_action_executions
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);


create or replace function public.servicedesk_require_workflow_preview_before_publish()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $
begin
  if old.state = 'DRAFT' and new.state = 'PUBLISHED' and not exists (
    select 1
    from public.workflow_executions e
    where e.workspace_id = old.workspace_id
      and e.rule_version_id = old.id
      and e.mode = 'PREVIEW'
      and e.state = 'PREVIEWED'
  ) then
    raise exception 'workflow draft must be previewed before publish'
      using errcode = '23514';
  end if;
  return new;
end;
$;

drop trigger if exists workflow_rule_versions_require_preview
on public.workflow_rule_versions;
create trigger workflow_rule_versions_require_preview
before update of state on public.workflow_rule_versions
for each row
execute function public.servicedesk_require_workflow_preview_before_publish();

create or replace function public.servicedesk_validate_workflow_event_snapshot(
  p_event_type text,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_allowed text[];
  v_key text;
  v_value jsonb;
begin
  if jsonb_typeof(p_snapshot) <> 'object'
     or (select count(*) from jsonb_object_keys(p_snapshot)) > 12 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_SNAPSHOT_INVALID');
  end if;

  v_allowed := public.servicedesk_workflow_allowed_condition_fields(p_event_type);
  if cardinality(v_allowed) = 0 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_TYPE_INVALID');
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_snapshot)
  loop
    if not (v_key = any(v_allowed)) then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_FIELD_NOT_ALLOWED');
    end if;
    if jsonb_typeof(v_value) not in ('string','number','boolean','null','array') then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_VALUE_INVALID');
    end if;
    if jsonb_typeof(v_value) = 'string' and length(v_value #>> '{}') > 160 then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_VALUE_INVALID');
    end if;
    if jsonb_typeof(v_value) = 'array' and jsonb_array_length(v_value) > 20 then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_VALUE_INVALID');
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.servicedesk_record_workflow_execution(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_version_id uuid := nullif(p_input->>'ruleVersionId','')::uuid;
  v_mode text := p_input->>'mode';
  v_execution_key text := nullif(trim(p_input->>'executionKey'),'');
  v_fingerprint text := nullif(trim(p_input->>'eventFingerprint'),'');
  v_snapshot jsonb := p_input->'eventSnapshot';
  v_matched boolean := coalesce((p_input->>'matched')::boolean,false);
  v_depth integer := coalesce(nullif(p_input->>'recursionDepth','')::integer,0);
  v_parent uuid := nullif(p_input->>'parentExecutionId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_version public.workflow_rule_versions%rowtype;
  v_rule public.workflow_rules%rowtype;
  v_existing public.workflow_executions%rowtype;
  v_execution public.workflow_executions%rowtype;
  v_snapshot_validation jsonb;
  v_action jsonb;
  v_index integer := 0;
  v_action_state text;
begin
  if v_workspace is null or v_branch is null or v_version_id is null
     or v_mode not in ('PREVIEW','LIVE') or v_execution_key is null
     or v_fingerprint is null or v_snapshot is null
  then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EXECUTION_INPUT_INVALID');
  end if;

  if v_depth < 0 or v_depth > 2 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_RECURSION_LIMIT');
  end if;

  select * into v_existing
  from public.workflow_executions
  where workspace_id = v_workspace and execution_key = v_execution_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'executionId', v_existing.id,
      'state', v_existing.state
    );
  end if;

  select * into v_version
  from public.workflow_rule_versions
  where workspace_id = v_workspace and id = v_version_id;

  if not found or v_version.branch_id <> v_branch then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_VERSION_NOT_FOUND');
  end if;

  select * into v_rule
  from public.workflow_rules
  where workspace_id = v_workspace and id = v_version.rule_id;

  if not found or v_rule.branch_id <> v_branch then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_RULE_NOT_FOUND');
  end if;

  if v_mode = 'LIVE' and (
    v_version.state <> 'PUBLISHED'
    or v_rule.status <> 'ACTIVE'
    or v_rule.published_version_number <> v_version.version_number
  ) then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PUBLISHED_VERSION_REQUIRED');
  end if;

  if v_mode = 'PREVIEW' and v_version.state not in ('DRAFT','PUBLISHED') then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PREVIEW_VERSION_INVALID');
  end if;

  v_snapshot_validation := public.servicedesk_validate_workflow_event_snapshot(
    v_version.event_type,
    v_snapshot
  );
  if coalesce((v_snapshot_validation->>'ok')::boolean,false) is false then
    return v_snapshot_validation;
  end if;

  if v_parent is not null and not exists (
    select 1 from public.workflow_executions parent
    where parent.workspace_id = v_workspace
      and parent.id = v_parent
      and parent.branch_id = v_branch
  ) then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PARENT_EXECUTION_INVALID');
  end if;

  insert into public.workflow_executions(
    workspace_id, branch_id, rule_id, rule_version_id, mode,
    event_type, execution_key, event_fingerprint, event_snapshot,
    matched, recursion_depth, parent_execution_id, state, created_at, completed_at
  ) values (
    v_workspace, v_branch, v_rule.id, v_version.id, v_mode,
    v_version.event_type, v_execution_key, v_fingerprint, v_snapshot,
    v_matched, v_depth, v_parent,
    case
      when v_mode = 'PREVIEW' then 'PREVIEWED'
      when not v_matched then 'SKIPPED'
      else 'ACTIONS_PENDING'
    end,
    v_now,
    case when v_mode = 'PREVIEW' or not v_matched then v_now else null end
  )
  returning * into v_execution;

  if v_matched then
    for v_action in select value from jsonb_array_elements(v_version.actions)
    loop
      v_action_state := case
        when v_mode = 'PREVIEW' then 'PREVIEW_ONLY'
        when v_action->>'type' in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
          then 'APPROVAL_REQUIRED'
        else 'PENDING'
      end;

      insert into public.workflow_action_executions(
        workspace_id, branch_id, execution_id, action_index, attempt_number,
        action_type, action_snapshot, state, created_at,
        completed_at
      ) values (
        v_workspace, v_branch, v_execution.id, v_index, 1,
        v_action->>'type', v_action, v_action_state, v_now,
        case when v_mode = 'PREVIEW' then v_now else null end
      );
      v_index := v_index + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'executionId', v_execution.id,
    'state', v_execution.state,
    'actionCount', case when v_matched then jsonb_array_length(v_version.actions) else 0 end
  );
exception when unique_violation then
  select * into v_existing
  from public.workflow_executions
  where workspace_id = v_workspace and execution_key = v_execution_key;
  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'executionId', v_existing.id,
      'state', v_existing.state
    );
  end if;
  return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EXECUTION_CONFLICT');
when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EXECUTION_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_preview_workflow_rule_version(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_version_id uuid := nullif(p_input->>'ruleVersionId','')::uuid;
  v_snapshot jsonb := p_input->'eventSnapshot';
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_version public.workflow_rule_versions%rowtype;
  v_validation jsonb;
  v_condition jsonb;
  v_actual jsonb;
  v_matched boolean := true;
  v_condition_match boolean;
  v_execution_key text;
  v_fingerprint text;
  v_recorded jsonb;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_version_id is null or v_snapshot is null
  then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PREVIEW_INPUT_INVALID');
  end if;

  select * into v_version
  from public.workflow_rule_versions
  where workspace_id = v_workspace and id = v_version_id;

  if not found or v_version.state not in ('DRAFT','PUBLISHED') then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PREVIEW_VERSION_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_version.branch_id, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_validation := public.servicedesk_validate_workflow_event_snapshot(
    v_version.event_type,
    v_snapshot
  );
  if coalesce((v_validation->>'ok')::boolean,false) is false then
    return v_validation;
  end if;

  for v_condition in select value from jsonb_array_elements(v_version.conditions)
  loop
    v_actual := v_snapshot -> (v_condition->>'field');
    v_condition_match := case v_condition->>'operator'
      when 'EQ' then v_actual = v_condition->'value'
      when 'NEQ' then v_actual is distinct from v_condition->'value'
      when 'IN' then exists (
        select 1
        from jsonb_array_elements(v_condition->'value') candidate
        where candidate = v_actual
      )
      else false
    end;
    v_matched := v_matched and v_condition_match;
  end loop;

  v_fingerprint := md5(v_version.id::text || ':' || v_snapshot::text);
  v_execution_key := 'preview:' || v_version.id::text || ':' || gen_random_uuid()::text;

  v_recorded := public.servicedesk_record_workflow_execution(
    jsonb_build_object(
      'workspaceId', v_workspace,
      'branchId', v_version.branch_id,
      'ruleVersionId', v_version.id,
      'mode', 'PREVIEW',
      'executionKey', v_execution_key,
      'eventFingerprint', v_fingerprint,
      'eventSnapshot', v_snapshot,
      'matched', v_matched,
      'recursionDepth', 0,
      'now', v_now
    )
  );

  if coalesce((v_recorded->>'ok')::boolean,false) is false then
    return v_recorded;
  end if;

  return jsonb_build_object(
    'ok', true,
    'executionId', v_recorded->>'executionId',
    'matched', v_matched,
    'actionCount', coalesce((v_recorded->>'actionCount')::integer,0),
    'eventType', v_version.event_type,
    'previewOnly', true
  );
end;
$;

create or replace function public.servicedesk_approve_workflow_external_action(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_action_id uuid := nullif(p_input->>'actionExecutionId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_action public.workflow_action_executions%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER' or v_action_id is null then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_APPROVAL_INPUT_INVALID');
  end if;

  select * into v_action
  from public.workflow_action_executions
  where workspace_id = v_workspace and id = v_action_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_NOT_FOUND');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_action.branch_id, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_action.action_type not in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
     or v_action.state <> 'APPROVAL_REQUIRED' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_NOT_APPROVABLE');
  end if;

  update public.workflow_action_executions
  set state = 'APPROVED',
      approved_by = v_actor,
      approved_at = v_now
  where workspace_id = v_workspace and id = v_action.id
  returning * into v_action;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'WORKFLOW_EXTERNAL_ACTION_APPROVED', 'workflow_action_execution', v_action.id,
    jsonb_build_object(
      'branchId', v_action.branch_id,
      'executionId', v_action.execution_id,
      'actionType', v_action.action_type,
      'attemptNumber', v_action.attempt_number
    ),
    v_now
  );

  return jsonb_build_object('ok', true, 'actionExecutionId', v_action.id, 'state', v_action.state);
end;
$$;

create or replace function public.servicedesk_execute_workflow_attention_action(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_action_id uuid := nullif(p_input->>'actionExecutionId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_action public.workflow_action_executions%rowtype;
  v_execution public.workflow_executions%rowtype;
  v_attention_id uuid;
  v_summary_key text;
  v_severity public.attention_severity;
begin
  if v_workspace is null or v_action_id is null then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_INPUT_INVALID');
  end if;

  select * into v_action
  from public.workflow_action_executions
  where workspace_id = v_workspace and id = v_action_id
  for update;

  if not found or v_action.action_type <> 'CREATE_ATTENTION' or v_action.state <> 'PENDING' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ATTENTION_ACTION_NOT_PENDING');
  end if;

  select * into v_execution
  from public.workflow_executions
  where workspace_id = v_workspace and id = v_action.execution_id;

  if not found or v_execution.mode <> 'LIVE' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_LIVE_EXECUTION_REQUIRED');
  end if;

  v_summary_key := v_action.action_snapshot->>'summaryKey';
  v_severity := (v_action.action_snapshot->>'severity')::public.attention_severity;

  insert into public.attention_items(
    workspace_id, type, resource_type, resource_id, severity, status,
    summary, created_at, updated_at
  ) values (
    v_workspace,
    'WORKFLOW_RULE',
    'workflow_execution',
    v_execution.id,
    v_severity,
    'OPEN',
    'Workflow action: ' || replace(v_summary_key, '_', ' '),
    v_now,
    v_now
  )
  on conflict (workspace_id, type, resource_type, resource_id)
    where status = 'OPEN'
  do update set
    severity = excluded.severity,
    summary = excluded.summary,
    updated_at = excluded.updated_at
  returning id into v_attention_id;

  update public.workflow_action_executions
  set state = 'SUCCEEDED',
      completed_at = v_now
  where workspace_id = v_workspace and id = v_action.id;

  if not exists (
    select 1
    from public.workflow_action_executions a
    where a.workspace_id = v_workspace
      and a.execution_id = v_action.execution_id
      and a.state in ('PENDING','APPROVAL_REQUIRED','APPROVED')
  ) then
    update public.workflow_executions
    set state = case
          when exists (
            select 1 from public.workflow_action_executions failed
            where failed.workspace_id = v_workspace
              and failed.execution_id = v_action.execution_id
              and failed.state = 'FAILED'
          ) then 'PARTIAL_FAILED'
          else 'COMPLETED'
        end,
        completed_at = v_now
    where workspace_id = v_workspace and id = v_action.execution_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'actionExecutionId', v_action.id,
    'state', 'SUCCEEDED',
    'attentionItemId', v_attention_id
  );
exception when invalid_text_representation then
  return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ATTENTION_ACTION_INVALID');
end;
$$;

create or replace function public.servicedesk_mark_workflow_action_result(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_action_id uuid := nullif(p_input->>'actionExecutionId','')::uuid;
  v_result text := p_input->>'result';
  v_error text := nullif(upper(trim(p_input->>'errorCode')),'');
  v_outbox uuid := nullif(p_input->>'outboxEventId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_action public.workflow_action_executions%rowtype;
  v_remaining integer;
  v_failed integer;
begin
  if v_workspace is null or v_action_id is null
     or v_result not in ('SUCCEEDED','FAILED','SUPPRESSED')
  then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_RESULT_INPUT_INVALID');
  end if;

  select * into v_action
  from public.workflow_action_executions
  where workspace_id = v_workspace and id = v_action_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_NOT_FOUND');
  end if;

  if v_action.state not in ('PENDING','APPROVED') then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_RESULT_STATE_INVALID');
  end if;

  if v_action.action_type in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
     and v_action.state <> 'APPROVED' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EXTERNAL_ACTION_APPROVAL_REQUIRED');
  end if;

  update public.workflow_action_executions
  set state = v_result,
      error_code = case when v_result = 'FAILED' then coalesce(v_error,'WORKFLOW_ACTION_FAILED') else v_error end,
      outbox_event_id = v_outbox,
      completed_at = v_now
  where workspace_id = v_workspace and id = v_action.id
  returning * into v_action;

  select
    count(*) filter (where state in ('PENDING','APPROVAL_REQUIRED','APPROVED')),
    count(*) filter (where state = 'FAILED')
  into v_remaining, v_failed
  from public.workflow_action_executions
  where workspace_id = v_workspace and execution_id = v_action.execution_id;

  if v_remaining = 0 then
    update public.workflow_executions
    set state = case when v_failed > 0 then 'PARTIAL_FAILED' else 'COMPLETED' end,
        completed_at = v_now
    where workspace_id = v_workspace and id = v_action.execution_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'actionExecutionId', v_action.id,
    'state', v_action.state
  );
exception when invalid_text_representation then
  return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_RESULT_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_replay_failed_workflow_action(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_action_id uuid := nullif(p_input->>'actionExecutionId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_action public.workflow_action_executions%rowtype;
  v_new public.workflow_action_executions%rowtype;
  v_next integer;
  v_new_state text;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER' or v_action_id is null then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_REPLAY_INPUT_INVALID');
  end if;

  select * into v_action
  from public.workflow_action_executions
  where workspace_id = v_workspace and id = v_action_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_NOT_FOUND');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_action.branch_id, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_action.state <> 'FAILED' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_REPLAY_REQUIRES_FAILED_ACTION');
  end if;

  select coalesce(max(attempt_number),0) + 1
  into v_next
  from public.workflow_action_executions
  where workspace_id = v_workspace
    and execution_id = v_action.execution_id
    and action_index = v_action.action_index;

  if v_next > 5 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_REPLAY_LIMIT');
  end if;

  v_new_state := case
    when v_action.action_type in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
      then 'APPROVAL_REQUIRED'
    else 'PENDING'
  end;

  insert into public.workflow_action_executions(
    workspace_id, branch_id, execution_id, action_index, attempt_number,
    action_type, action_snapshot, state, replay_of_action_execution_id, created_at
  ) values (
    v_workspace, v_action.branch_id, v_action.execution_id, v_action.action_index, v_next,
    v_action.action_type, v_action.action_snapshot, v_new_state, v_action.id, v_now
  )
  returning * into v_new;

  update public.workflow_executions
  set state = 'ACTIONS_PENDING',
      completed_at = null
  where workspace_id = v_workspace and id = v_action.execution_id;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'WORKFLOW_ACTION_REPLAYED', 'workflow_action_execution', v_new.id,
    jsonb_build_object(
      'branchId', v_new.branch_id,
      'executionId', v_new.execution_id,
      'actionIndex', v_new.action_index,
      'attemptNumber', v_new.attempt_number,
      'replayOfActionExecutionId', v_action.id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'actionExecutionId', v_new.id,
    'state', v_new.state,
    'attemptNumber', v_new.attempt_number,
    'sourceBookingReplayed', false
  );
end;
$$;

revoke all on function public.servicedesk_validate_workflow_event_snapshot(text, jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_record_workflow_execution(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_preview_workflow_rule_version(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_approve_workflow_external_action(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_execute_workflow_attention_action(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_mark_workflow_action_result(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_replay_failed_workflow_action(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_validate_workflow_event_snapshot(text, jsonb) to service_role;
grant execute on function public.servicedesk_record_workflow_execution(jsonb) to service_role;
grant execute on function public.servicedesk_preview_workflow_rule_version(jsonb) to service_role;
grant execute on function public.servicedesk_approve_workflow_external_action(jsonb) to service_role;
grant execute on function public.servicedesk_execute_workflow_attention_action(jsonb) to service_role;
grant execute on function public.servicedesk_mark_workflow_action_result(jsonb) to service_role;
grant execute on function public.servicedesk_replay_failed_workflow_action(jsonb) to service_role;

comment on table public.workflow_executions is
  'Workflow decision log. PREVIEW rows cannot produce live side effects; LIVE rows track a single source event without mutating it.';
comment on function public.servicedesk_replay_failed_workflow_action(jsonb) is
  'Creates one new action attempt for a failed workflow action. Never replays the originating booking/domain event.';
