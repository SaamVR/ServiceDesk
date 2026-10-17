-- Disposable PostgreSQL17 exercise; no connected Supabase access or user data.
-- Existing rowtype fixture supplies two workspaces, their default branches and
-- seven active table triggers. Introduce a minimal auth context and membership
-- model to reproduce the real SECURITY DEFINER authorization boundary.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.role() returns text
language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

do $create_roles$
begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
end
$create_roles$;

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null,
  status text not null check (status in ('ACTIVE','REVOKED')),
  primary key (workspace_id,user_id)
);
insert into public.memberships(workspace_id,user_id,status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001','ACTIVE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'bbbbbbbb-0000-4000-8000-000000000002','ACTIVE'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-0000-4000-8000-000000000003','REVOKED');
grant usage on schema public, auth to authenticated, service_role, anon;
grant execute on function auth.uid(),auth.role() to authenticated,service_role;
grant select on public.workspace_branches to authenticated;
grant insert,select on public.properties to authenticated;
