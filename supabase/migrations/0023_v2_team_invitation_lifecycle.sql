-- V2 team invitation lifecycle: owner creation/revocation + authenticated acceptance.
-- Raw invitation tokens are never persisted. Only SHA-256 hex hashes are stored.

create index if not exists invitations_workspace_email_created_idx
  on public.invitations(workspace_id, email, created_at desc);

create or replace function public.servicedesk_create_team_invitation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_email citext := nullif(lower(trim(p_input->>'email')), '')::citext;
  v_role public.membership_role := nullif(p_input->>'role','')::public.membership_role;
  v_token_hash text := lower(coalesce(p_input->>'tokenHash',''));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_expires_at timestamptz := nullif(p_input->>'expiresAt','')::timestamptz;
  v_invitation public.invitations%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_email is null or v_role is null
     or v_token_hash !~ '^[0-9a-f]{64}$' or v_expires_at is null then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_INPUT_INVALID');
  end if;

  if v_actor_role <> 'OWNER' or not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace
      and user_id = v_actor_user
      and status = 'ACTIVE'
      and role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'OWNER_SCOPE_REQUIRED');
  end if;

  if position('@' in v_email::text) < 2 then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EMAIL_INVALID');
  end if;

  if v_expires_at <= v_now + interval '5 minutes'
     or v_expires_at > v_now + interval '14 days' then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRY_INVALID');
  end if;

  if exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = v_workspace
      and m.status = 'ACTIVE'
      and lower(u.email) = lower(v_email::text)
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMBER_ALREADY_ACTIVE');
  end if;

  select *
  into v_invitation
  from public.invitations
  where workspace_id = v_workspace
    and email = v_email
    and accepted_at is null
    and revoked_at is null
    and expires_at > v_now
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.invitations
    set role = v_role,
        token_hash = v_token_hash,
        expires_at = v_expires_at,
        created_by = v_actor_user,
        created_at = v_now
    where id = v_invitation.id
    returning * into v_invitation;
  else
    insert into public.invitations (
      workspace_id, email, role, token_hash, expires_at, created_by, created_at
    ) values (
      v_workspace, v_email, v_role, v_token_hash, v_expires_at, v_actor_user, v_now
    )
    returning * into v_invitation;
  end if;

  insert into public.audit_events (
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace,
    v_actor_user,
    'OWNER',
    'TEAM_INVITATION_ISSUED',
    'team_invitation',
    v_invitation.id,
    jsonb_build_object(
      'email', v_invitation.email,
      'role', v_invitation.role::text,
      'expiresAt', v_invitation.expires_at
    )
  );

  return jsonb_build_object(
    'ok', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'email', v_invitation.email,
      'role', v_invitation.role::text,
      'state', 'PENDING',
      'createdAt', v_invitation.created_at,
      'expiresAt', v_invitation.expires_at
    )
  );
end;
$$;

create or replace function public.servicedesk_revoke_team_invitation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_invitation_id uuid := nullif(p_input->>'invitationId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_invitation public.invitations%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_invitation_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_INPUT_INVALID');
  end if;

  if v_actor_role <> 'OWNER' or not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace
      and user_id = v_actor_user
      and status = 'ACTIVE'
      and role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'OWNER_SCOPE_REQUIRED');
  end if;

  select *
  into v_invitation
  from public.invitations
  where workspace_id = v_workspace and id = v_invitation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND');
  end if;

  if v_invitation.accepted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_ALREADY_ACCEPTED');
  end if;

  if v_invitation.revoked_at is null then
    update public.invitations
    set revoked_at = v_now
    where id = v_invitation.id;

    insert into public.audit_events (
      workspace_id, actor_user_id, actor_role, action, resource_type, resource_id
    ) values (
      v_workspace, v_actor_user, 'OWNER', 'TEAM_INVITATION_REVOKED', 'team_invitation', v_invitation.id
    );
  end if;

  return jsonb_build_object('ok', true, 'invitationId', v_invitation.id, 'state', 'REVOKED');
end;
$$;

create or replace function public.servicedesk_read_team_invitation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_token_hash text := lower(coalesce(p_input->>'tokenHash',''));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_user_email text;
  v_invitation public.invitations%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if v_actor_user is null or v_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_INPUT_INVALID');
  end if;

  select lower(email) into v_user_email from auth.users where id = v_actor_user;
  if v_user_email is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_USER_NOT_FOUND');
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = v_token_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND');
  end if;
  if lower(v_invitation.email::text) <> v_user_email then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EMAIL_MISMATCH');
  end if;
  if v_invitation.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_REVOKED');
  end if;
  if v_invitation.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRED');
  end if;

  select * into v_workspace from public.workspaces where id = v_invitation.workspace_id;

  return jsonb_build_object(
    'ok', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'workspaceId', v_invitation.workspace_id,
      'workspaceSlug', v_workspace.slug,
      'workspaceName', v_workspace.name,
      'email', v_invitation.email,
      'role', v_invitation.role::text,
      'state', case when v_invitation.accepted_at is null then 'PENDING' else 'ACCEPTED' end,
      'expiresAt', v_invitation.expires_at
    )
  );
end;
$$;

create or replace function public.servicedesk_accept_team_invitation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_token_hash text := lower(coalesce(p_input->>'tokenHash',''));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_user_email text;
  v_invitation public.invitations%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if v_actor_user is null or v_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_INPUT_INVALID');
  end if;

  select lower(email) into v_user_email from auth.users where id = v_actor_user;
  if v_user_email is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_USER_NOT_FOUND');
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = v_token_hash
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND');
  end if;
  if lower(v_invitation.email::text) <> v_user_email then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EMAIL_MISMATCH');
  end if;
  if v_invitation.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_REVOKED');
  end if;
  if v_invitation.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRED');
  end if;

  insert into public.memberships (
    workspace_id, user_id, role, status, version, created_at, updated_at
  ) values (
    v_invitation.workspace_id, v_actor_user, v_invitation.role, 'ACTIVE', 1, v_now, v_now
  )
  on conflict (workspace_id, user_id) do update
  set role = excluded.role,
      status = 'ACTIVE',
      version = public.memberships.version + 1,
      updated_at = v_now;

  if v_invitation.accepted_at is null then
    update public.invitations
    set accepted_at = v_now
    where id = v_invitation.id;

    insert into public.audit_events (
      workspace_id, actor_user_id, actor_role, action, resource_type, resource_id,
      after_data
    ) values (
      v_invitation.workspace_id,
      v_actor_user,
      v_invitation.role::text,
      'TEAM_INVITATION_ACCEPTED',
      'team_invitation',
      v_invitation.id,
      jsonb_build_object('role', v_invitation.role::text)
    );
  end if;

  select * into v_workspace from public.workspaces where id = v_invitation.workspace_id;

  return jsonb_build_object(
    'ok', true,
    'workspaceId', v_invitation.workspace_id,
    'workspaceSlug', v_workspace.slug,
    'workspaceName', v_workspace.name,
    'role', v_invitation.role::text
  );
end;
$$;

-- Extend owner settings presentation with invitation email/expiry, while keeping raw tokens private.
create or replace function public.servicedesk_read_owner_settings_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_services jsonb;
  v_members jsonb;
  v_invitations jsonb;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'OWNER_SETTINGS_INPUT_INVALID');
  end if;
  if v_actor_role <> 'OWNER' or not exists (
    select 1 from public.memberships
    where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', sc.code, 'label', sc.name, 'enabled', sc.active
  ) order by sc.code), '[]'::jsonb)
  into v_services
  from public.service_catalog sc
  where sc.workspace_id = v_workspace;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', m.user_id, 'role', m.role::text, 'active', m.status = 'ACTIVE'
  ) order by m.created_at), '[]'::jsonb)
  into v_members
  from public.memberships m
  where m.workspace_id = v_workspace;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'email', i.email,
    'role', i.role::text,
    'state', case
      when i.revoked_at is not null then 'REVOKED'
      when i.accepted_at is not null then 'ACCEPTED'
      when i.expires_at < now() then 'REVOKED'
      else 'PENDING'
    end,
    'createdAt', i.created_at,
    'expiresAt', i.expires_at
  ) order by i.created_at desc), '[]'::jsonb)
  into v_invitations
  from public.invitations i
  where i.workspace_id = v_workspace;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'services', v_services,
      'members', v_members,
      'invitations', v_invitations
    )
  );
end;
$$;

revoke execute on function public.servicedesk_create_team_invitation(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_revoke_team_invitation(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_read_team_invitation(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_accept_team_invitation(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_create_team_invitation(jsonb) to service_role;
grant execute on function public.servicedesk_revoke_team_invitation(jsonb) to service_role;
grant execute on function public.servicedesk_read_team_invitation(jsonb) to service_role;
grant execute on function public.servicedesk_accept_team_invitation(jsonb) to service_role;
