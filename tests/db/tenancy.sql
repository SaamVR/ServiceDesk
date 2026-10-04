-- Run after supabase db reset in a local/test project.
-- This script intentionally rolls back all fixture data.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test','',now(),now()),
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test','',now(),now())
on conflict (id) do nothing;

insert into public.workspaces (id,slug,name)
values
 ('10000000-0000-4000-8000-000000000001','tenant-a','Tenant A'),
 ('20000000-0000-4000-8000-000000000002','tenant-b','Tenant B');

insert into public.memberships (workspace_id,user_id,role,status)
values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000a1','OWNER','ACTIVE'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000b1','OWNER','ACTIVE');

insert into public.customers (id,workspace_id,display_name)
values
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Customer A'),
 ('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Customer B');

insert into public.properties (id,workspace_id,customer_id,address_line1,city,postal_code)
values
 ('11100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','1 A Street','London','A1 1AA'),
 ('22200000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','2 B Street','London','B2 2BB');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);

do $$
declare visible_b integer;
begin
  select count(*) into visible_b
  from public.properties
  where workspace_id='20000000-0000-4000-8000-000000000002';
  if visible_b <> 0 then
    raise exception 'cross-tenant RLS failure: tenant A can see tenant B properties';
  end if;
end $$;

reset role;
update public.memberships
set status='REVOKED'
where workspace_id='10000000-0000-4000-8000-000000000001'
  and user_id='00000000-0000-4000-8000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);

do $$
declare visible_a integer;
begin
  select count(*) into visible_a from public.customers
  where workspace_id='10000000-0000-4000-8000-000000000001';
  if visible_a <> 0 then
    raise exception 'revocation failure: revoked member can still read customers';
  end if;
end $$;

rollback;
