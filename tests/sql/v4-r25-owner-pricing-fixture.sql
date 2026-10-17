-- Disposable PG17 R25 fixture, entirely synthetic.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create type public.membership_role as enum ('OWNER','DISPATCHER');
create table public.memberships (workspace_id uuid, user_id uuid, role public.membership_role,status text);
create table public.workspace_branches (id uuid primary key, workspace_id uuid, currency char(3),active boolean);
create table public.service_catalog (workspace_id uuid,code text,name text,active boolean);
create table public.rate_cards (
 id uuid primary key default gen_random_uuid(),workspace_id uuid,version text,currency char(3),
 deposit_percent integer,valid_hours integer,buffer_minutes integer,active boolean,rules jsonb,
 unique(workspace_id,version));
create table public.branch_price_books (
 id uuid primary key default gen_random_uuid(),workspace_id uuid,branch_id uuid,rate_card_id uuid,
 active boolean,version bigint default 1,created_by uuid,starts_at timestamptz,ends_at timestamptz,
 updated_at timestamptz default now());
create unique index one_active on public.branch_price_books(workspace_id,branch_id) where active;
create table public.audit_events (workspace_id uuid,actor_user_id uuid,actor_role text,action text,
 resource_type text,resource_id uuid,request_id text,before_data jsonb,after_data jsonb);
create function public.servicedesk_actor_has_branch_access(w uuid,b uuid,u uuid,r text,allowed public.membership_role[])
returns boolean language sql stable as $$
 select exists(select 1 from public.memberships m join public.workspace_branches bb on m.workspace_id=bb.workspace_id
 where m.workspace_id=w and m.user_id=u and m.role::text=r and m.role=any(allowed)
 and m.status='ACTIVE' and bb.id=b and bb.active);
$$;
insert into public.memberships values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff','OWNER','ACTIVE'),
 ('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888','OWNER','ACTIVE');
insert into public.workspace_branches values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','USD',true),
 ('77777777-7777-4777-8777-777777777777','99999999-9999-4999-8999-999999999999','USD',true);
insert into public.service_catalog values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STANDARD','Standard cleaning',true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DEEP','Deep cleaning',true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MOVE_OUT','Move-out cleaning',true);
insert into public.rate_cards(id,workspace_id,version,currency,deposit_percent,valid_hours,buffer_minutes,active,rules) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','old','USD',25,48,30,true,'{"broken":true}');
insert into public.branch_price_books(id,workspace_id,branch_id,rate_card_id,active,version) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true,7);
