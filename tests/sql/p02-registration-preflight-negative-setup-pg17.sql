\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 ONLY; synthetic identities and rows, no Supabase network.
create schema auth;
create function auth.role() returns text language sql stable
  as $$ select current_setting('request.jwt.claim.role', true) $$;
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
  ('dddddddd-0000-4000-8000-000000000004', now(), false),
  ('eeeeeeee-0000-4000-8000-000000000005', now(), false),
  ('ffffffff-0000-4000-8000-000000000006', now(), false);

\i supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql
\i supabase/migrations/0065_v4_default_branch_membership_authority.sql
-- Isolated DB from the existing project's disposable PG17 service.
-- Global PG17 roles are already created by the main fixture. This fixture
-- intentionally reuses those roles without touching the service database.
-- Verify the exact ORIGINAL registration and #0065 branch function before
-- exercising separate fail-closed preflight guards in the CI lane.
\i docs/engineering/security/p02-registration-live-readonly-preflight.sql
select 'P02_FRESH_BASELINE_PREFLIGHT_PASS' as result;
