-- Only disposable PG17 CI. Minimal table shapes reproduce all seven
-- REAL branch-guard trigger rowtypes without tenant data or Supabase secrets.
create table public.workspaces (
  id uuid primary key
);
create table public.workspace_branches (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  active boolean not null,
  is_default boolean not null default false
);
create table public.properties (
  id uuid primary key, workspace_id uuid not null,
  branch_id uuid
);
create table public.requests (
  id uuid primary key, workspace_id uuid not null, branch_id uuid,
  property_id uuid
);
create table public.conversations (
  id uuid primary key, workspace_id uuid not null, branch_id uuid,
  request_id uuid
);
create table public.crews (
  id uuid primary key, workspace_id uuid not null, branch_id uuid
);
create table public.capacity_slots (
  id uuid primary key, workspace_id uuid not null, branch_id uuid,
  crew_id uuid
);
create table public.visits (
  id uuid primary key, workspace_id uuid not null, branch_id uuid,
  request_id uuid, crew_id uuid, slot_id uuid
);
create table public.recurrence_rules (
  id uuid primary key, workspace_id uuid not null, branch_id uuid,
  request_id uuid, property_id uuid
);
create function public.servicedesk_default_branch(target_workspace uuid)
returns uuid language sql stable security invoker set search_path = ''
as $$
  select b.id from public.workspace_branches b
  where b.workspace_id=target_workspace and b.active=true
  order by b.is_default desc,b.id limit 1
$$;
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_branches (id,workspace_id,active,is_default) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,true),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,false),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,true),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false,false);
