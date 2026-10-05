-- ServiceDesk AI V2: owner-managed service catalog
-- Trusted server command for editing existing service presentation/availability without exposing service credentials.

create or replace function public.servicedesk_update_service_catalog_item(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_service_id uuid := nullif(p_input->>'serviceId','')::uuid;
  v_name text := nullif(trim(p_input->>'name'), '');
  v_active boolean := case when p_input ? 'active' then (p_input->>'active')::boolean else null end;
  v_requires_review boolean := case when p_input ? 'requiresReview' then (p_input->>'requiresReview')::boolean else null end;
  v_expected_updated_at timestamptz := nullif(p_input->>'expectedUpdatedAt','')::timestamptz;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'), '');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_existing public.servicedesk_command_idempotency%rowtype;
  v_service public.service_catalog%rowtype;
  v_before jsonb;
begin
  if v_workspace is null
     or v_actor_user is null
     or v_actor_role <> 'OWNER'
     or v_service_id is null
     or v_name is null
     or length(v_name) > 120
     or v_active is null
     or v_requires_review is null
     or v_expected_updated_at is null
     or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_CATALOG_INPUT_INVALID');
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.workspace_id = v_workspace
      and m.user_id = v_actor_user
      and m.status = 'ACTIVE'
      and m.role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'OWNER_SCOPE_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_workspace::text),
    hashtext('service_catalog.update:' || v_idempotency)
  );

  select * into v_existing
  from public.servicedesk_command_idempotency
  where workspace_id = v_workspace
    and command_scope = 'service_catalog.update'
    and idempotency_key = v_idempotency;

  if found then
    if v_existing.resource_id <> v_service_id then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;

    select * into v_service
    from public.service_catalog
    where workspace_id = v_workspace
      and id = v_service_id;

    if not found
       or v_service.name <> v_name
       or v_service.active is distinct from v_active
       or v_service.requires_review is distinct from v_requires_review then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'service', jsonb_build_object(
        'id', v_service.id,
        'workspaceId', v_service.workspace_id,
        'code', v_service.code,
        'name', v_service.name,
        'active', v_service.active,
        'requiresReview', v_service.requires_review,
        'updatedAt', v_service.updated_at
      )
    );
  end if;

  select * into v_service
  from public.service_catalog
  where workspace_id = v_workspace
    and id = v_service_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_NOT_FOUND');
  end if;

  if v_service.updated_at <> v_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_VERSION_CONFLICT');
  end if;

  v_before := jsonb_build_object(
    'code', v_service.code,
    'name', v_service.name,
    'active', v_service.active,
    'requiresReview', v_service.requires_review,
    'updatedAt', v_service.updated_at
  );

  update public.service_catalog
  set name = v_name,
      active = v_active,
      requires_review = v_requires_review,
      updated_at = v_now
  where workspace_id = v_workspace
    and id = v_service_id
  returning * into v_service;

  insert into public.servicedesk_command_idempotency(
    workspace_id,
    command_scope,
    idempotency_key,
    resource_type,
    resource_id
  ) values (
    v_workspace,
    'service_catalog.update',
    v_idempotency,
    'service_catalog',
    v_service.id
  );

  insert into public.audit_events(
    workspace_id,
    actor_user_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    request_id,
    before_data,
    after_data,
    created_at
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'service_catalog.updated',
    'service_catalog',
    v_service.id,
    v_idempotency,
    v_before,
    jsonb_build_object(
      'code', v_service.code,
      'name', v_service.name,
      'active', v_service.active,
      'requiresReview', v_service.requires_review,
      'updatedAt', v_service.updated_at
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'service', jsonb_build_object(
      'id', v_service.id,
      'workspaceId', v_service.workspace_id,
      'code', v_service.code,
      'name', v_service.name,
      'active', v_service.active,
      'requiresReview', v_service.requires_review,
      'updatedAt', v_service.updated_at
    )
  );
exception
  when invalid_text_representation or check_violation or unique_violation then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_CATALOG_UPDATE_REJECTED');
end;
$$;

revoke all on function public.servicedesk_update_service_catalog_item(jsonb) from public;
revoke all on function public.servicedesk_update_service_catalog_item(jsonb) from anon;
revoke all on function public.servicedesk_update_service_catalog_item(jsonb) from authenticated;
grant execute on function public.servicedesk_update_service_catalog_item(jsonb) to service_role;

comment on function public.servicedesk_update_service_catalog_item(jsonb) is
  'Trusted service-role owner command for updating existing service catalog presentation and availability with stale-write, idempotency, workspace, and audit protection.';
