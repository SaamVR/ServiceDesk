-- ServiceDesk AI V2 Wave 2D.1: multi-branch management commands and read model.
-- Owner remains company-wide. Dispatcher/Crew access is explicit per branch.

create or replace function public.servicedesk_create_workspace_branch(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_code text := upper(trim(p_input->>'code'));
  v_name text := trim(p_input->>'name');
  v_timezone text := trim(p_input->>'timezone');
  v_currency text := upper(trim(p_input->>'currency'));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_branch public.workspace_branches%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_code is null or v_name is null or v_timezone is null
     or v_currency !~ '^[A-Z]{3}$'
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  begin
    perform v_now at time zone v_timezone;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_TIMEZONE_INVALID');
  end;

  insert into public.workspace_branches(
    workspace_id, code, name, timezone, currency, active, is_default,
    version, created_at, updated_at
  ) values (
    v_workspace, v_code, v_name, v_timezone, v_currency::char(3), true, false,
    1, v_now, v_now
  )
  returning * into v_branch;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action,
    resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role,
    'workspace.branch.created',
    'workspace_branch', v_branch.id,
    jsonb_build_object(
      'code', v_branch.code,
      'name', v_branch.name,
      'timezone', v_branch.timezone,
      'currency', v_branch.currency,
      'active', v_branch.active
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'branch', jsonb_build_object(
      'id', v_branch.id,
      'workspaceId', v_branch.workspace_id,
      'code', v_branch.code,
      'name', v_branch.name,
      'timezone', v_branch.timezone,
      'currency', v_branch.currency,
      'active', v_branch.active,
      'isDefault', v_branch.is_default,
      'version', v_branch.version
    )
  );
exception
  when unique_violation or check_violation or invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_update_workspace_branch(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_branch_id uuid := nullif(p_input->>'branchId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_name text := trim(p_input->>'name');
  v_timezone text := trim(p_input->>'timezone');
  v_currency text := upper(trim(p_input->>'currency'));
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_branch public.workspace_branches%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_branch_id is null or v_expected is null or v_name is null
     or v_timezone is null or v_currency !~ '^[A-Z]{3}$'
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_UPDATE_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  begin
    perform v_now at time zone v_timezone;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_TIMEZONE_INVALID');
  end;

  select * into v_branch
  from public.workspace_branches
  where workspace_id = v_workspace and id = v_branch_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_NOT_FOUND');
  end if;
  if v_branch.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;
  if v_branch.is_default and not v_active then
    return jsonb_build_object('ok', false, 'code', 'DEFAULT_BRANCH_CANNOT_DEACTIVATE');
  end if;

  update public.workspace_branches
  set name = v_name,
      timezone = v_timezone,
      currency = v_currency::char(3),
      active = v_active,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_branch_id
  returning * into v_branch;

  return jsonb_build_object(
    'ok', true,
    'branch', jsonb_build_object(
      'id', v_branch.id,
      'workspaceId', v_branch.workspace_id,
      'code', v_branch.code,
      'name', v_branch.name,
      'timezone', v_branch.timezone,
      'currency', v_branch.currency,
      'active', v_branch.active,
      'isDefault', v_branch.is_default,
      'version', v_branch.version
    )
  );
exception
  when check_violation or invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_UPDATE_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_set_branch_membership(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_target_user uuid := nullif(p_input->>'targetUserId','')::uuid;
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_target_role public.membership_role;
  v_membership public.branch_memberships%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_branch is null or v_target_user is null
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_MEMBERSHIP_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_branches b
    where b.workspace_id = v_workspace and b.id = v_branch and b.active
  ) then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_NOT_AVAILABLE');
  end if;

  select m.role into v_target_role
  from public.memberships m
  where m.workspace_id = v_workspace
    and m.user_id = v_target_user
    and m.status = 'ACTIVE';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MEMBER_NOT_AVAILABLE');
  end if;

  if v_target_role = 'OWNER' then
    return jsonb_build_object(
      'ok', true,
      'ownerGlobalAccess', true,
      'branchId', v_branch,
      'userId', v_target_user,
      'active', true
    );
  end if;

  insert into public.branch_memberships(
    workspace_id, branch_id, user_id, active, version, created_at, updated_at
  ) values (
    v_workspace, v_branch, v_target_user, v_active, 1, v_now, v_now
  )
  on conflict (workspace_id, branch_id, user_id) do update
  set active = excluded.active,
      version = public.branch_memberships.version + 1,
      updated_at = v_now
  returning * into v_membership;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action,
    resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role,
    case when v_active then 'workspace.branch.member.assigned'
         else 'workspace.branch.member.revoked' end,
    'workspace_branch', v_branch,
    jsonb_build_object(
      'targetUserId', v_target_user,
      'targetRole', v_target_role,
      'active', v_membership.active,
      'version', v_membership.version
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'ownerGlobalAccess', false,
    'branchId', v_branch,
    'userId', v_target_user,
    'role', v_target_role,
    'active', v_membership.active,
    'version', v_membership.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_MEMBERSHIP_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_read_branch_access_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_branches jsonb;
  v_assignments jsonb;
begin
  if v_workspace is null or v_actor_user is null
     or v_actor_role not in ('OWNER','DISPATCHER','CREW')
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_READ_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'workspaceId', b.workspace_id,
      'code', b.code,
      'name', b.name,
      'timezone', b.timezone,
      'currency', b.currency,
      'active', b.active,
      'isDefault', b.is_default,
      'version', b.version
    )
    order by b.is_default desc, b.name, b.id
  ), '[]'::jsonb)
  into v_branches
  from public.workspace_branches b
  where b.workspace_id = v_workspace
    and (
      v_actor_role = 'OWNER'
      or exists (
        select 1 from public.branch_memberships bm
        where bm.workspace_id = b.workspace_id
          and bm.branch_id = b.id
          and bm.user_id = v_actor_user
          and bm.active
      )
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'branchId', bm.branch_id,
      'userId', bm.user_id,
      'role', m.role,
      'active', bm.active,
      'version', bm.version
    )
    order by bm.branch_id, m.role, bm.user_id
  ), '[]'::jsonb)
  into v_assignments
  from public.branch_memberships bm
  join public.memberships m
    on m.workspace_id = bm.workspace_id and m.user_id = bm.user_id
  where bm.workspace_id = v_workspace
    and (
      v_actor_role = 'OWNER'
      or bm.user_id = v_actor_user
    );

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'ownerGlobalAccess', v_actor_role = 'OWNER',
      'branches', v_branches,
      'assignments', v_assignments
    )
  );
exception when invalid_text_representation then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_READ_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_create_workspace_branch(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_update_workspace_branch(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_branch_membership(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_read_branch_access_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_create_workspace_branch(jsonb) to service_role;
grant execute on function public.servicedesk_update_workspace_branch(jsonb) to service_role;
grant execute on function public.servicedesk_set_branch_membership(jsonb) to service_role;
grant execute on function public.servicedesk_read_branch_access_snapshot(jsonb) to service_role;

comment on function public.servicedesk_set_branch_membership(jsonb) is
  'Owner-only assignment for non-owner branch access. Workspace owners remain company-wide and do not depend on branch membership rows.';
