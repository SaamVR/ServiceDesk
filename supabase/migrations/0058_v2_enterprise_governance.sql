-- ServiceDesk AI V2 Wave 2D.3A: enterprise governance controls.
-- Adds fixed-capability delegation, time-bounded read-only tenant support access,
-- and metadata-only audit export. Does not widen membership roles or tenant boundaries.

create table if not exists public.operator_capability_grants (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (
    capability in (
      'SERVICE_CATALOG_MANAGE'
    )
  ),
  status text not null check (status in ('ACTIVE','REVOKED')),
  expires_at timestamptz,
  granted_by uuid not null references auth.users(id),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, capability),
  foreign key (workspace_id, user_id)
    references public.memberships(workspace_id, user_id) on delete cascade,
  check (
    (status = 'ACTIVE' and revoked_at is null and revoked_by is null)
    or
    (status = 'REVOKED' and revoked_at is not null and revoked_by is not null)
  )
);

create table if not exists public.tenant_support_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  support_subject_hash text not null check (
    support_subject_hash ~ '^[a-f0-9]{64}$'
  ),
  scope text not null check (
    scope in ('READ_DIAGNOSTICS','READ_AUDIT_METADATA')
  ),
  reason text not null check (length(trim(reason)) between 4 and 240),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (expires_at > approved_at),
  check (expires_at <= approved_at + interval '24 hours'),
  check (
    (revoked_at is null and revoked_by is null)
    or
    (revoked_at is not null and revoked_by is not null)
  )
);

create index if not exists operator_capability_active_idx
  on public.operator_capability_grants(workspace_id, user_id, capability, expires_at)
  where status = 'ACTIVE';

create index if not exists tenant_support_access_active_idx
  on public.tenant_support_access_grants(workspace_id, support_subject_hash, scope, expires_at)
  where revoked_at is null;

alter table public.operator_capability_grants enable row level security;
alter table public.tenant_support_access_grants enable row level security;

revoke all on table public.operator_capability_grants from public, anon, authenticated;
revoke all on table public.tenant_support_access_grants from public, anon, authenticated;

grant select on table public.operator_capability_grants to authenticated;
grant select on table public.tenant_support_access_grants to authenticated;
grant select, insert, update, delete on table public.operator_capability_grants to service_role;
grant select, insert, update, delete on table public.tenant_support_access_grants to service_role;

drop policy if exists operator_capability_staff_select on public.operator_capability_grants;
create policy operator_capability_staff_select
on public.operator_capability_grants
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
);

drop policy if exists tenant_support_access_owner_select on public.tenant_support_access_grants;
create policy tenant_support_access_owner_select
on public.tenant_support_access_grants
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

create or replace function public.servicedesk_actor_has_governance_capability(
  p_workspace uuid,
  p_user uuid,
  p_role text,
  p_capability text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (
      p_role = 'OWNER'
      and public.servicedesk_actor_is_workspace_owner(p_workspace, p_user, p_role)
    )
    or exists (
      select 1
      from public.operator_capability_grants g
      join public.memberships m
        on m.workspace_id = g.workspace_id
       and m.user_id = g.user_id
      where g.workspace_id = p_workspace
        and g.user_id = p_user
        and g.capability = p_capability
        and g.status = 'ACTIVE'
        and (g.expires_at is null or g.expires_at > p_at)
        and m.status = 'ACTIVE'
        and m.role = 'DISPATCHER'
    );
$$;

revoke all on function public.servicedesk_actor_has_governance_capability(uuid,uuid,text,text,timestamptz)
from public, anon, authenticated;
grant execute on function public.servicedesk_actor_has_governance_capability(uuid,uuid,text,text,timestamptz)
to service_role;

create or replace function public.servicedesk_set_operator_capability(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_user uuid := nullif(p_input->>'userId','')::uuid;
  v_capability text := upper(trim(p_input->>'capability'));
  v_status text := upper(trim(p_input->>'status'));
  v_expires timestamptz := nullif(p_input->>'expiresAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_member public.memberships%rowtype;
  v_row public.operator_capability_grants%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_user is null
     or v_capability not in (
       'SERVICE_CATALOG_MANAGE'
     )
     or v_status not in ('ACTIVE','REVOKED')
  then
    return jsonb_build_object('ok', false, 'code', 'OPERATOR_CAPABILITY_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_member
  from public.memberships
  where workspace_id = v_workspace and user_id = v_user and status = 'ACTIVE';

  if not found or v_member.role <> 'DISPATCHER' then
    return jsonb_build_object('ok', false, 'code', 'DELEGATE_MEMBER_INVALID');
  end if;

  if v_status = 'ACTIVE' and v_expires is not null and v_expires <= v_now then
    return jsonb_build_object('ok', false, 'code', 'DELEGATION_EXPIRY_INVALID');
  end if;

  insert into public.operator_capability_grants(
    workspace_id, user_id, capability, status, expires_at,
    granted_by, revoked_by, revoked_at, version, created_at, updated_at
  ) values (
    v_workspace, v_user, v_capability, v_status,
    case when v_status = 'ACTIVE' then v_expires else null end,
    v_actor,
    case when v_status = 'REVOKED' then v_actor else null end,
    case when v_status = 'REVOKED' then v_now else null end,
    1, v_now, v_now
  )
  on conflict (workspace_id, user_id, capability) do update
  set status = excluded.status,
      expires_at = excluded.expires_at,
      granted_by = case when excluded.status = 'ACTIVE' then v_actor else public.operator_capability_grants.granted_by end,
      revoked_by = excluded.revoked_by,
      revoked_at = excluded.revoked_at,
      version = public.operator_capability_grants.version + 1,
      updated_at = v_now
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    case when v_status = 'ACTIVE' then 'OPERATOR_CAPABILITY_GRANTED' else 'OPERATOR_CAPABILITY_REVOKED' end,
    'membership', v_user,
    jsonb_build_object(
      'capability', v_capability,
      'status', v_status,
      'expiresAt', case when v_status = 'ACTIVE' then v_expires else null end
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'userId', v_row.user_id,
    'capability', v_row.capability,
    'status', v_row.status,
    'expiresAt', v_row.expires_at,
    'version', v_row.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'OPERATOR_CAPABILITY_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_grant_tenant_support_access(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_subject text := lower(trim(p_input->>'supportSubjectHash'));
  v_scope text := upper(trim(p_input->>'scope'));
  v_reason text := trim(p_input->>'reason');
  v_expires timestamptz := nullif(p_input->>'expiresAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.tenant_support_access_grants%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_subject !~ '^[a-f0-9]{64}$'
     or v_scope not in ('READ_DIAGNOSTICS','READ_AUDIT_METADATA')
     or length(v_reason) < 4 or v_expires is null
     or v_expires <= v_now or v_expires > v_now + interval '24 hours'
  then
    return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.tenant_support_access_grants(
    workspace_id, support_subject_hash, scope, reason,
    approved_by, approved_at, expires_at, created_at
  ) values (
    v_workspace, v_subject, v_scope, v_reason,
    v_actor, v_now, v_expires, v_now
  )
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'TENANT_SUPPORT_ACCESS_GRANTED', 'support_access', v_row.id,
    jsonb_build_object(
      'scope', v_row.scope,
      'expiresAt', v_row.expires_at,
      'supportSubjectHashPrefix', left(v_row.support_subject_hash, 8)
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'grantId', v_row.id,
    'scope', v_row.scope,
    'expiresAt', v_row.expires_at
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_revoke_tenant_support_access(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_grant uuid := nullif(p_input->>'grantId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.tenant_support_access_grants%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER' or v_grant is null then
    return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_REVOKE_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  update public.tenant_support_access_grants
  set revoked_by = v_actor,
      revoked_at = v_now
  where workspace_id = v_workspace
    and id = v_grant
    and revoked_at is null
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_NOT_ACTIVE');
  end if;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'TENANT_SUPPORT_ACCESS_REVOKED', 'support_access', v_row.id,
    jsonb_build_object('scope', v_row.scope, 'revokedAt', v_now),
    v_now
  );

  return jsonb_build_object('ok', true, 'grantId', v_row.id, 'revokedAt', v_now);
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_REVOKE_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_check_tenant_support_access(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_subject text := lower(trim(p_input->>'supportSubjectHash'));
  v_scope text := upper(trim(p_input->>'scope'));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_grant public.tenant_support_access_grants%rowtype;
begin
  if v_workspace is null or v_subject !~ '^[a-f0-9]{64}$'
     or v_scope not in ('READ_DIAGNOSTICS','READ_AUDIT_METADATA') then
    return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_CHECK_INPUT_INVALID');
  end if;

  select * into v_grant
  from public.tenant_support_access_grants
  where workspace_id = v_workspace
    and support_subject_hash = v_subject
    and scope = v_scope
    and revoked_at is null
    and expires_at > v_now
  order by expires_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'allowed', found,
    'grantId', case when found then v_grant.id else null end,
    'scope', v_scope,
    'expiresAt', case when found then v_grant.expires_at else null end
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'SUPPORT_ACCESS_CHECK_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_read_audit_export_metadata(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_from timestamptz := nullif(p_input->>'from','')::timestamptz;
  v_to timestamptz := nullif(p_input->>'to','')::timestamptz;
  v_limit integer := least(coalesce(nullif(p_input->>'limit','')::integer, 1000), 5000);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
begin
  if v_workspace is null or v_actor is null or v_from is null or v_to is null
     or v_to <= v_from or v_to - v_from > interval '31 days'
     or v_limit < 1 then
    return jsonb_build_object('ok', false, 'code', 'AUDIT_EXPORT_INPUT_INVALID');
  end if;

  if v_role <> 'OWNER'
     or not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'from', v_from,
    'to', v_to,
    'truncated', (
      select count(*) > v_limit
      from public.audit_events e
      where e.workspace_id = v_workspace
        and e.created_at >= v_from
        and e.created_at < v_to
    ),
    'rows', coalesce((
      select jsonb_agg(row_json order by row_json->>'createdAt')
      from (
        select jsonb_build_object(
          'id', e.id,
          'actorRole', e.actor_role,
          'action', e.action,
          'resourceType', e.resource_type,
          'resourceId', e.resource_id,
          'requestId', e.request_id,
          'createdAt', e.created_at
        ) as row_json
        from public.audit_events e
        where e.workspace_id = v_workspace
          and e.created_at >= v_from
          and e.created_at < v_to
        order by e.created_at asc, e.id asc
        limit v_limit
      ) bounded
    ), '[]'::jsonb),
    'redaction', 'Metadata only. before_data and after_data are intentionally excluded.'
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'AUDIT_EXPORT_INPUT_INVALID');
end;
$$;


create or replace function public.servicedesk_update_service_catalog_item(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $
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
     or v_actor_role not in ('OWNER','DISPATCHER')
     or v_service_id is null
     or v_name is null
     or length(v_name) > 120
     or v_active is null
     or v_requires_review is null
     or v_expected_updated_at is null
     or v_idempotency is null then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_CATALOG_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_has_governance_capability(
    v_workspace, v_actor_user, v_actor_role, 'SERVICE_CATALOG_MANAGE', v_now
  ) then
    return jsonb_build_object('ok', false, 'code', 'SERVICE_CATALOG_SCOPE_REQUIRED');
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
$;

revoke all on function public.servicedesk_update_service_catalog_item(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_update_service_catalog_item(jsonb) to service_role;

comment on function public.servicedesk_update_service_catalog_item(jsonb) is
  'Trusted service-role command for owner or explicitly delegated dispatcher service-catalog management; preserves stale-write, idempotency, workspace and audit protection.';

revoke all on function public.servicedesk_set_operator_capability(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_grant_tenant_support_access(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_revoke_tenant_support_access(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_check_tenant_support_access(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_read_audit_export_metadata(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_set_operator_capability(jsonb) to service_role;
grant execute on function public.servicedesk_grant_tenant_support_access(jsonb) to service_role;
grant execute on function public.servicedesk_revoke_tenant_support_access(jsonb) to service_role;
grant execute on function public.servicedesk_check_tenant_support_access(jsonb) to service_role;
grant execute on function public.servicedesk_read_audit_export_metadata(jsonb) to service_role;

comment on table public.operator_capability_grants is
  'Owner-granted dispatcher governance capabilities. Does not create new tenant roles or bypass branch/tenant scope; audit export remains owner-only.';
comment on table public.tenant_support_access_grants is
  'Owner-approved, read-only support access grants capped at 24 hours. No write or impersonation scope exists.';
comment on function public.servicedesk_read_audit_export_metadata(jsonb) is
  'Bounded 31-day metadata-only audit export. before_data/after_data are excluded to avoid exporting payload PII or secrets.';
