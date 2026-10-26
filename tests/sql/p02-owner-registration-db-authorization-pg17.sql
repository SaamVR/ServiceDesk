\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 ONLY; synthetic identities and rows, no Supabase network.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (
  id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean not null default false
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, timezone text not null, currency char(3) not null
);
create table public.memberships (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null, role text not null, status text not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create table public.workspace_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  code text, name text, timezone text, currency char(3),
  is_default boolean not null, active boolean not null
);
create table public.branch_memberships (
  workspace_id uuid not null, branch_id uuid not null,
  user_id uuid not null, status text not null
);
create table public.audit_events (
  workspace_id uuid, actor_user_id uuid, actor_role text,
  action text, resource_type text, resource_id uuid
);
insert into auth.users(id,email_confirmed_at,is_anonymous)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', now(), false),
  ('bbbbbbbb-0000-4000-8000-000000000002', now(), false),
  ('cccccccc-0000-4000-8000-000000000003', null, false),
  ('dddddddd-0000-4000-8000-000000000004', now(), false);

\i docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql

do $catalog$
begin
  if not has_function_privilege('authenticated',
    'public.servicedesk_register_owner_workspace(text,text,text,text)', 'EXECUTE')
    or has_function_privilege('anon',
    'public.servicedesk_register_owner_workspace(text,text,text,text)', 'EXECUTE') then
    raise exception 'Registration RPC grants do not match signed-in-only contract';
  end if;
  if has_schema_privilege('authenticated','servicedesk_security','USAGE')
    or has_schema_privilege('anon','servicedesk_security','USAGE')
    or has_table_privilege('authenticated',
       'servicedesk_security.owner_registration_grants','INSERT')
    or has_table_privilege('authenticated',
       'servicedesk_security.owner_registration_control','UPDATE') then
    raise exception 'Client can access protected registration controls';
  end if;
  if (select mode from servicedesk_security.owner_registration_control
      where singleton) is distinct from 'CLOSED' then
    raise exception 'New registration did not default to CLOSED';
  end if;
end $catalog$;

-- A/B both denied in CLOSED, with zero workspace/audit writes.
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $closed_a$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic A','qa-owner-a','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'Closed mode allowed owner A: %', result;
  end if;
end $closed_a$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-0000-4000-8000-000000000002';
do $closed_b$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic B','qa-owner-b','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'Closed mode allowed owner B: %', result;
  end if;
end $closed_b$;
rollback;

update servicedesk_security.owner_registration_control set mode='QA_ONLY';
-- A has no grant, then an expired grant: both must fail closed.
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $nogrant$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic A','qa-owner-a','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'QA_ONLY accepted an ungranted owner';
  end if;
end $nogrant$;
rollback;

insert into servicedesk_security.owner_registration_grants(user_id,expires_at)
values('aaaaaaaa-0000-4000-8000-000000000001',now()-interval '1 minute');
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $expired$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic A','qa-owner-a','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'Expired grant accepted';
  end if;
end $expired$;
rollback;

update servicedesk_security.owner_registration_grants
  set expires_at=now()+interval '1 hour'
  where user_id='aaaaaaaa-0000-4000-8000-000000000001';
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $approve_a$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic A','qa-owner-a','UTC','USD');
  if result->>'ok' is distinct from 'true' or result->>'existing' is distinct from 'false' then
    raise exception 'QA approved owner A cannot register: %', result;
  end if;
end $approve_a$;
commit;

-- Revoke A grant; existing owner must retain idempotent OWN readback, no write.
update servicedesk_security.owner_registration_grants
  set revoked_at=now() where user_id='aaaaaaaa-0000-4000-8000-000000000001';
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $idempotent$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic Different','other-slug','UTC','USD');
  if result->>'ok' is distinct from 'true' or result->>'existing' is distinct from 'true'
    or result->>'slug' is distinct from 'qa-owner-a' then
    raise exception 'Existing owner idempotent readback regressed: %', result;
  end if;
end $idempotent$;
rollback;

-- Owner B is still denied. Then grant B explicitly and allow only B.
begin;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-0000-4000-8000-000000000002';
do $deny_b$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic B','qa-owner-b','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'QA_ONLY allowed unapproved owner B';
  end if;
end $deny_b$;
rollback;
-- A revoked grant must DENY a brand-new owner, not merely be checked
-- on the already registered owner's idempotent readback.
insert into servicedesk_security.owner_registration_grants(user_id,expires_at,revoked_at)
values('bbbbbbbb-0000-4000-8000-000000000002',now()+interval '1 hour',now());
begin;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-0000-4000-8000-000000000002';
do $revoked_new_owner$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic B','qa-owner-b','UTC','USD');
  if result->>'code' is distinct from 'REGISTRATION_NOT_AUTHORIZED' then
    raise exception 'Revoked new-owner registration grant was accepted';
  end if;
end $revoked_new_owner$;
rollback;

update servicedesk_security.owner_registration_grants set revoked_at=null
where user_id='bbbbbbbb-0000-4000-8000-000000000002';
begin;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-0000-4000-8000-000000000002';
do $approve_b$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic B','qa-owner-b','UTC','USD');
  if result->>'ok' is distinct from 'true' or result->>'slug' is distinct from 'qa-owner-b' then
    raise exception 'QA approved owner B cannot register: %', result;
  end if;
end $approve_b$;
commit;

do $two_owners$
begin
  if (select count(*) from public.workspaces) <> 2
    or (select count(*) from public.memberships where role='OWNER' and status='ACTIVE') <> 2
    or (select count(*) from public.workspace_branches where is_default and active) <> 2
    or (select count(*) from public.branch_memberships where status='ACTIVE') <> 2
    or (select count(*) from public.audit_events where action='WORKSPACE_REGISTERED') <> 2
  then raise exception 'Two synthetic owner registrations did not write exactly scoped atomic rows';
  end if;
  if exists (
     select 1 from public.memberships m
     join public.workspaces w on w.id=m.workspace_id
     where (m.user_id='aaaaaaaa-0000-4000-8000-000000000001' and w.slug<>'qa-owner-a')
        or (m.user_id='bbbbbbbb-0000-4000-8000-000000000002' and w.slug<>'qa-owner-b')
  ) then raise exception 'Cross-owner workspace row scope violated';
  end if;
end $two_owners$;

-- Public mode must itself be a privileged DB decision. Unverified C remains denied.
update servicedesk_security.owner_registration_control set mode='PUBLIC';
begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-0000-4000-8000-000000000003';
do $unconfirmed$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic C','qa-owner-c','UTC','USD');
  if result->>'code' is distinct from 'EMAIL_VERIFICATION_REQUIRED' then
    raise exception 'Unconfirmed user registered in PUBLIC mode';
  end if;
end $unconfirmed$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-0000-4000-8000-000000000004';
do $public_mode$
declare result jsonb;
begin
  result:=public.servicedesk_register_owner_workspace(
    'Synthetic D','qa-owner-d','UTC','USD');
  if result->>'ok' is distinct from 'true' then
    raise exception 'Explicit PUBLIC mode failed for confirmed new owner: %',result;
  end if;
end $public_mode$;
commit;
do $final$
begin
  if (select count(*) from public.workspaces) <> 3 then
    raise exception 'Wrong post-PUBLIC synthetic workspace count';
  end if;
end $final$;
select 'P02_DISPOSABLE_PG17_REGISTRATION_DB_AUTHORIZATION_PASS' as result;
