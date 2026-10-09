-- ServiceDesk AI V2 Wave 2D.2: controlled workflow-rule authority.
-- Rules are branch-scoped, versioned and restricted to a fixed event/condition/action catalogue.
-- No arbitrary code, SQL, URL, provider endpoint, money mutation or booking-state mutation is accepted.

create table if not exists public.workflow_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  branch_id uuid not null,
  code text not null check (
    code = upper(code)
    and code ~ '^[A-Z0-9][A-Z0-9_-]{2,63}$'
  ),
  name text not null check (length(trim(name)) between 1 and 120),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  published_version_number integer,
  created_by uuid not null references auth.users(id),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, branch_id, code),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete restrict,
  check (published_version_number is null or published_version_number > 0)
);

create table if not exists public.workflow_rule_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  branch_id uuid not null,
  rule_id uuid not null,
  version_number integer not null check (version_number > 0),
  state text not null default 'DRAFT'
    check (state in ('DRAFT','PUBLISHED','RETIRED')),
  event_type text not null check (
    event_type in (
      'REQUEST_CREATED',
      'QUOTE_ACCEPTED',
      'VISIT_COMPLETED',
      'INVOICE_PAID',
      'ATTENTION_OPENED'
    )
  ),
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null,
  max_actions_per_event integer not null default 3 check (max_actions_per_event between 1 and 5),
  based_on_version_number integer,
  created_by uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, rule_id, version_number),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete restrict,
  foreign key (workspace_id, rule_id)
    references public.workflow_rules(workspace_id, id) on delete cascade,
  check (based_on_version_number is null or based_on_version_number > 0),
  check (
    (state = 'PUBLISHED' and published_by is not null and published_at is not null)
    or state <> 'PUBLISHED'
  )
);

create index if not exists workflow_rules_branch_status_idx
  on public.workflow_rules(workspace_id, branch_id, status, updated_at desc);
create index if not exists workflow_rule_versions_rule_idx
  on public.workflow_rule_versions(workspace_id, rule_id, version_number desc);
create unique index if not exists workflow_rule_one_published_version_idx
  on public.workflow_rule_versions(workspace_id, rule_id)
  where state = 'PUBLISHED';

alter table public.workflow_rules enable row level security;
alter table public.workflow_rule_versions enable row level security;

revoke all on table public.workflow_rules from public, anon, authenticated;
revoke all on table public.workflow_rule_versions from public, anon, authenticated;
grant select on table public.workflow_rules to authenticated;
grant select on table public.workflow_rule_versions to authenticated;
grant select, insert, update, delete on table public.workflow_rules to service_role;
grant select, insert, update, delete on table public.workflow_rule_versions to service_role;

drop policy if exists workflow_rules_staff_select on public.workflow_rules;
create policy workflow_rules_staff_select
on public.workflow_rules
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);

drop policy if exists workflow_rule_versions_staff_select on public.workflow_rule_versions;
create policy workflow_rule_versions_staff_select
on public.workflow_rule_versions
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);

create or replace function public.servicedesk_workflow_allowed_condition_fields(p_event_type text)
returns text[]
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select case p_event_type
    when 'REQUEST_CREATED' then array['request.serviceCode','request.leadSource','request.branchCode']::text[]
    when 'QUOTE_ACCEPTED' then array['quote.currency','quote.branchCode','request.serviceCode']::text[]
    when 'VISIT_COMPLETED' then array['visit.branchCode','request.serviceCode','visit.hasIncident']::text[]
    when 'INVOICE_PAID' then array['invoice.currency','invoice.branchCode','request.serviceCode']::text[]
    when 'ATTENTION_OPENED' then array['attention.type','attention.severity','attention.branchCode']::text[]
    else array[]::text[]
  end;
$$;

create or replace function public.servicedesk_validate_workflow_definition(
  p_event_type text,
  p_conditions jsonb,
  p_actions jsonb,
  p_max_actions integer
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_condition jsonb;
  v_action jsonb;
  v_field text;
  v_operator text;
  v_action_type text;
  v_allowed_fields text[];
begin
  if p_event_type not in (
    'REQUEST_CREATED','QUOTE_ACCEPTED','VISIT_COMPLETED','INVOICE_PAID','ATTENTION_OPENED'
  ) then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EVENT_TYPE_INVALID');
  end if;

  if p_max_actions is null or p_max_actions < 1 or p_max_actions > 5 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_CAP_INVALID');
  end if;

  if jsonb_typeof(p_conditions) <> 'array'
     or jsonb_array_length(p_conditions) > 8 then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITIONS_INVALID');
  end if;

  if jsonb_typeof(p_actions) <> 'array'
     or jsonb_array_length(p_actions) < 1
     or jsonb_array_length(p_actions) > p_max_actions then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTIONS_INVALID');
  end if;

  v_allowed_fields := public.servicedesk_workflow_allowed_condition_fields(p_event_type);

  for v_condition in select value from jsonb_array_elements(p_conditions)
  loop
    if jsonb_typeof(v_condition) <> 'object' then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITION_INVALID');
    end if;

    v_field := v_condition->>'field';
    v_operator := v_condition->>'operator';

    if v_field is null or not (v_field = any(v_allowed_fields))
       or v_operator not in ('EQ','NEQ','IN') then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITION_CATALOGUE_VIOLATION');
    end if;

    if v_operator = 'IN' then
      if jsonb_typeof(v_condition->'value') <> 'array'
         or jsonb_array_length(v_condition->'value') < 1
         or jsonb_array_length(v_condition->'value') > 20 then
        return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITION_VALUE_INVALID');
      end if;
    elsif not (v_condition ? 'value') then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITION_VALUE_INVALID');
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_condition) key
      where key not in ('field','operator','value')
    ) then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_CONDITION_EXTRA_FIELD');
    end if;
  end loop;

  for v_action in select value from jsonb_array_elements(p_actions)
  loop
    if jsonb_typeof(v_action) <> 'object' then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_INVALID');
    end if;

    v_action_type := v_action->>'type';

    if v_action_type = 'CREATE_ATTENTION' then
      if (v_action->>'severity') not in ('INFO','WARNING','CRITICAL')
         or coalesce(v_action->>'summaryKey','') !~ '^[A-Z0-9][A-Z0-9_:-]{2,79}$'
      then
        return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ATTENTION_ACTION_INVALID');
      end if;
      if exists (
        select 1 from jsonb_object_keys(v_action) key
        where key not in ('type','severity','summaryKey')
      ) then
        return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_EXTRA_FIELD');
      end if;

    elsif v_action_type in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE') then
      if coalesce(v_action->>'templateKey','') !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$'
         or coalesce(v_action->>'recipient','') <> 'CUSTOMER_PRIMARY'
      then
        return jsonb_build_object('ok', false, 'code', 'WORKFLOW_EXTERNAL_SEND_ACTION_INVALID');
      end if;
      if exists (
        select 1 from jsonb_object_keys(v_action) key
        where key not in ('type','templateKey','recipient')
      ) then
        return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_EXTRA_FIELD');
      end if;

    else
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ACTION_CATALOGUE_VIOLATION');
    end if;

    if (v_action::text ~* '(https?://|\bsql\b|javascript:|data:|webhook|api[_-]?key|secret|token)') then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_UNSAFE_ACTION_MATERIAL');
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'conditionCount', jsonb_array_length(p_conditions),
    'actionCount', jsonb_array_length(p_actions),
    'hasExternalSend', exists (
      select 1
      from jsonb_array_elements(p_actions) a
      where a->>'type' in ('SEND_EMAIL_TEMPLATE','SEND_WHATSAPP_TEMPLATE')
    )
  );
end;
$$;

create or replace function public.servicedesk_prevent_published_workflow_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.state = 'PUBLISHED' and (
    new.event_type is distinct from old.event_type
    or new.conditions is distinct from old.conditions
    or new.actions is distinct from old.actions
    or new.max_actions_per_event is distinct from old.max_actions_per_event
    or new.rule_id is distinct from old.rule_id
    or new.branch_id is distinct from old.branch_id
    or new.version_number is distinct from old.version_number
  ) then
    raise exception 'published workflow versions are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_rule_versions_immutable_published
on public.workflow_rule_versions;
create trigger workflow_rule_versions_immutable_published
before update on public.workflow_rule_versions
for each row
execute function public.servicedesk_prevent_published_workflow_version_mutation();

create or replace function public.servicedesk_save_workflow_rule_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_rule_id uuid := nullif(p_input->>'ruleId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedRuleVersion','')::bigint;
  v_code text := upper(trim(p_input->>'code'));
  v_name text := trim(p_input->>'name');
  v_event text := p_input->>'eventType';
  v_conditions jsonb := coalesce(p_input->'conditions','[]'::jsonb);
  v_actions jsonb := p_input->'actions';
  v_cap integer := coalesce(nullif(p_input->>'maxActionsPerEvent','')::integer,3);
  v_validation jsonb;
  v_rule public.workflow_rules%rowtype;
  v_version public.workflow_rule_versions%rowtype;
  v_next integer;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
begin
  if v_workspace is null or v_branch is null or v_actor is null
     or v_role <> 'OWNER' or v_code is null or v_name is null or v_actions is null
  then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_DRAFT_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_branch, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_validation := public.servicedesk_validate_workflow_definition(
    v_event, v_conditions, v_actions, v_cap
  );
  if coalesce((v_validation->>'ok')::boolean,false) is false then
    return v_validation;
  end if;

  if v_rule_id is null then
    insert into public.workflow_rules(
      workspace_id, branch_id, code, name, status, created_by, created_at, updated_at
    ) values (
      v_workspace, v_branch, v_code, v_name, 'DRAFT', v_actor, v_now, v_now
    )
    returning * into v_rule;
  else
    select * into v_rule
    from public.workflow_rules
    where workspace_id = v_workspace and id = v_rule_id
    for update;

    if not found or v_rule.branch_id <> v_branch then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_RULE_NOT_FOUND');
    end if;

    if v_expected is null or v_rule.version <> v_expected then
      return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
    end if;

    if v_rule.status = 'ARCHIVED' then
      return jsonb_build_object('ok', false, 'code', 'WORKFLOW_RULE_ARCHIVED');
    end if;

    update public.workflow_rules
    set code = v_code,
        name = v_name,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace and id = v_rule.id
    returning * into v_rule;
  end if;

  select coalesce(max(version_number),0) + 1
  into v_next
  from public.workflow_rule_versions
  where workspace_id = v_workspace and rule_id = v_rule.id;

  insert into public.workflow_rule_versions(
    workspace_id, branch_id, rule_id, version_number, state,
    event_type, conditions, actions, max_actions_per_event,
    based_on_version_number, created_by, created_at
  ) values (
    v_workspace, v_branch, v_rule.id, v_next, 'DRAFT',
    v_event, v_conditions, v_actions, v_cap,
    v_rule.published_version_number, v_actor, v_now
  )
  returning * into v_version;

  return jsonb_build_object(
    'ok', true,
    'ruleId', v_rule.id,
    'ruleVersion', v_rule.version,
    'draftVersionId', v_version.id,
    'draftVersionNumber', v_version.version_number,
    'hasExternalSend', v_validation->'hasExternalSend'
  );
exception when unique_violation or check_violation
  or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'WORKFLOW_DRAFT_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_publish_workflow_rule_version(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_version_id uuid := nullif(p_input->>'versionId','')::uuid;
  v_rule public.workflow_rules%rowtype;
  v_version public.workflow_rule_versions%rowtype;
  v_validation jsonb;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER' or v_version_id is null then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_PUBLISH_INPUT_INVALID');
  end if;

  select * into v_version
  from public.workflow_rule_versions
  where workspace_id = v_workspace and id = v_version_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_VERSION_NOT_FOUND');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_version.branch_id, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_version.state <> 'DRAFT' then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_VERSION_NOT_DRAFT');
  end if;

  v_validation := public.servicedesk_validate_workflow_definition(
    v_version.event_type, v_version.conditions, v_version.actions, v_version.max_actions_per_event
  );
  if coalesce((v_validation->>'ok')::boolean,false) is false then
    return v_validation;
  end if;

  select * into v_rule
  from public.workflow_rules
  where workspace_id = v_workspace and id = v_version.rule_id
  for update;

  update public.workflow_rule_versions
  set state = 'RETIRED'
  where workspace_id = v_workspace
    and rule_id = v_rule.id
    and state = 'PUBLISHED';

  update public.workflow_rule_versions
  set state = 'PUBLISHED',
      published_by = v_actor,
      published_at = v_now
  where workspace_id = v_workspace and id = v_version.id
  returning * into v_version;

  update public.workflow_rules
  set status = 'ACTIVE',
      published_version_number = v_version.version_number,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_rule.id
  returning * into v_rule;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'WORKFLOW_RULE_VERSION_PUBLISHED', 'workflow_rule', v_rule.id,
    jsonb_build_object(
      'branchId', v_rule.branch_id,
      'versionNumber', v_version.version_number,
      'eventType', v_version.event_type,
      'hasExternalSend', v_validation->'hasExternalSend'
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'ruleId', v_rule.id,
    'ruleVersion', v_rule.version,
    'publishedVersionId', v_version.id,
    'publishedVersionNumber', v_version.version_number
  );
end;
$$;

create or replace function public.servicedesk_rollback_workflow_rule(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_rule_id uuid := nullif(p_input->>'ruleId','')::uuid;
  v_target integer := nullif(p_input->>'targetVersionNumber','')::integer;
  v_rule public.workflow_rules%rowtype;
  v_source public.workflow_rule_versions%rowtype;
  v_new public.workflow_rule_versions%rowtype;
  v_next integer;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_rule_id is null or v_target is null or v_target < 1
  then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ROLLBACK_INPUT_INVALID');
  end if;

  select * into v_rule
  from public.workflow_rules
  where workspace_id = v_workspace and id = v_rule_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_RULE_NOT_FOUND');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role)
     or not public.servicedesk_actor_has_branch_access(
       v_workspace, v_rule.branch_id, v_actor, v_role,
       array['OWNER']::public.membership_role[]
     )
  then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_source
  from public.workflow_rule_versions
  where workspace_id = v_workspace
    and rule_id = v_rule.id
    and version_number = v_target
    and state in ('PUBLISHED','RETIRED');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'WORKFLOW_ROLLBACK_TARGET_INVALID');
  end if;

  select coalesce(max(version_number),0) + 1
  into v_next
  from public.workflow_rule_versions
  where workspace_id = v_workspace and rule_id = v_rule.id;

  update public.workflow_rule_versions
  set state = 'RETIRED'
  where workspace_id = v_workspace
    and rule_id = v_rule.id
    and state = 'PUBLISHED';

  insert into public.workflow_rule_versions(
    workspace_id, branch_id, rule_id, version_number, state,
    event_type, conditions, actions, max_actions_per_event,
    based_on_version_number, created_by, published_by, published_at, created_at
  ) values (
    v_workspace, v_rule.branch_id, v_rule.id, v_next, 'PUBLISHED',
    v_source.event_type, v_source.conditions, v_source.actions, v_source.max_actions_per_event,
    v_source.version_number, v_actor, v_actor, v_now, v_now
  )
  returning * into v_new;

  update public.workflow_rules
  set status = 'ACTIVE',
      published_version_number = v_new.version_number,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_rule.id
  returning * into v_rule;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'WORKFLOW_RULE_ROLLED_BACK', 'workflow_rule', v_rule.id,
    jsonb_build_object(
      'branchId', v_rule.branch_id,
      'sourceVersionNumber', v_source.version_number,
      'newPublishedVersionNumber', v_new.version_number
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'ruleId', v_rule.id,
    'publishedVersionId', v_new.id,
    'publishedVersionNumber', v_new.version_number
  );
end;
$$;

revoke all on function public.servicedesk_workflow_allowed_condition_fields(text) from public, anon, authenticated;
revoke all on function public.servicedesk_validate_workflow_definition(text, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.servicedesk_save_workflow_rule_draft(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_publish_workflow_rule_version(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_rollback_workflow_rule(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_workflow_allowed_condition_fields(text) to service_role;
grant execute on function public.servicedesk_validate_workflow_definition(text, jsonb, jsonb, integer) to service_role;
grant execute on function public.servicedesk_save_workflow_rule_draft(jsonb) to service_role;
grant execute on function public.servicedesk_publish_workflow_rule_version(jsonb) to service_role;
grant execute on function public.servicedesk_rollback_workflow_rule(jsonb) to service_role;

comment on table public.workflow_rule_versions is
  'Immutable published workflow definitions restricted to ServiceDesk fixed event, condition and action catalogues.';
comment on function public.servicedesk_validate_workflow_definition(text, jsonb, jsonb, integer) is
  'Validates a workflow definition against the fixed safe catalogue. Arbitrary code, SQL, URLs and open provider endpoints are rejected.';
