-- ServiceDesk V3: atomic, verified, self-service owner workspace bootstrap.
-- This migration is source-controlled only. Do not apply to production without
-- the ordinary migration rehearsal and explicit deployment authorization.

create or replace function public.servicedesk_register_owner_workspace(
  p_name text,
  p_slug text,
  p_timezone text default 'UTC',
  p_currency text default 'USD'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $servicedesk_registration$
declare
  v_actor uuid := (select auth.uid());
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_timezone text := trim(coalesce(p_timezone, ''));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_workspace uuid;
  v_existing_slug text;
  v_branch uuid;
begin
  -- Do not trust user_metadata, caller IDs, client-owned roles or actor IDs.
  if v_actor is null or not exists (
    select 1 from auth.users u
    where u.id = v_actor
      and u.email_confirmed_at is not null
      and u.is_anonymous is not true
  ) then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_VERIFICATION_REQUIRED');
  end if;

  if length(v_name) not between 2 and 120
     or v_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$'
     or v_slug like '%--%'
     or v_slug like '%-'
     or length(v_timezone) not between 2 and 64
     or v_currency !~ '^[A-Z]{3}$'
  then
    return jsonb_build_object('ok', false, 'code', 'WORKSPACE_INPUT_INVALID');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    return jsonb_build_object('ok', false, 'code', 'TIMEZONE_INVALID');
  end if;

  -- Prevent concurrent registration for one auth account from producing two
  -- owner workspaces, while allowing existing member/invite flows unchanged.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text, 0)
  );

  select w.slug::text into v_existing_slug
  from public.memberships m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = v_actor and m.role = 'OWNER' and m.status = 'ACTIVE'
  order by m.created_at asc
  limit 1;

  if v_existing_slug is not null then
    return jsonb_build_object('ok', true, 'slug', v_existing_slug, 'existing', true);
  end if;

  if exists (select 1 from public.workspaces where slug = v_slug) then
    return jsonb_build_object('ok', false, 'code', 'SLUG_UNAVAILABLE');
  end if;

  -- Every write belongs to the same transaction; failures leave no half-built
  -- workspace, membership or branch.
  insert into public.workspaces(slug, name, timezone, currency)
  values (v_slug, v_name, v_timezone, v_currency::char(3))
  returning id into v_workspace;

  insert into public.memberships(workspace_id, user_id, role, status)
  values (v_workspace, v_actor, 'OWNER', 'ACTIVE');

  insert into public.workspace_branches(
    workspace_id, code, name, timezone, currency, is_default, active
  ) values (
    v_workspace, 'MAIN', v_name, v_timezone, v_currency::char(3), true, true
  ) returning id into v_branch;

  insert into public.branch_memberships(
    workspace_id, branch_id, user_id, status
  ) values (v_workspace, v_branch, v_actor, 'ACTIVE');

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id
  ) values (
    v_workspace, v_actor, 'OWNER', 'WORKSPACE_REGISTERED', 'WORKSPACE', v_workspace
  );

  return jsonb_build_object('ok', true, 'slug', v_slug, 'existing', false);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'SLUG_UNAVAILABLE');
end;
$servicedesk_registration$;

-- Functions default to PUBLIC execution unless explicitly revoked.
revoke all on function public.servicedesk_register_owner_workspace(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.servicedesk_register_owner_workspace(text, text, text, text)
  to authenticated;

comment on function public.servicedesk_register_owner_workspace(text, text, text, text) is
  'Verified auth.uid only: atomic initial OWNER workspace, MAIN branch, scoped audit. Idempotent per owner. No direct table-write privileges.';
