-- Disposable PostgreSQL 17 F23 hold-release schema. All UUIDs fictional.
-- Run only against dedicated localhost sd_f23_disposable; NOT connected Supabase.
\set ON_ERROR_STOP on
create schema if not exists public;
do $roles$
begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end;
$roles$;
create table public.memberships (
 workspace_id uuid not null,user_id uuid not null,status text not null,role text not null,
 primary key(workspace_id,user_id)
);
create table public.requests (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 version bigint not null
);
create table public.quotes (
 id uuid primary key,workspace_id uuid not null,request_id uuid not null,
 status text not null,version bigint not null
);
create table public.slot_holds (
 id uuid primary key,workspace_id uuid not null,quote_id uuid not null,
 slot_id uuid not null,status text not null,expires_at timestamptz not null,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.capacity_slots (
 id uuid primary key,workspace_id uuid not null,crew_id uuid not null,
 starts_at timestamptz not null
);
create table public.crews (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 active boolean not null default true
);
create table public.visits (
 id uuid primary key,workspace_id uuid not null,quote_id uuid not null
);
create table public.verified_payment_applications (
 id uuid primary key,workspace_id uuid not null,quote_id uuid not null,
 hold_id uuid not null,state text not null
);
grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;
-- FOR UPDATE on quotes requires UPDATE privilege even without a write.
grant update on public.quotes to service_role;
grant update(status,updated_at) on public.slot_holds to service_role;
insert into public.memberships values
 ('11111111-1111-4111-8111-111111111111','77777777-7777-4777-8777-777777777777','ACTIVE','OWNER');
insert into public.requests values
 ('44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',5);
insert into public.quotes values
 ('33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444','ACCEPTED',4);
insert into public.slot_holds values
 ('88888888-8888-4888-8888-888888888888',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '55555555-5555-4555-8555-555555555555',
 'HELD','2100-01-02T00:00:00Z',clock_timestamp());
insert into public.capacity_slots values
 ('55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 '66666666-6666-4666-8666-666666666666',
 '2100-01-03T10:00:00Z');
insert into public.crews values
 ('66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',true);
-- The real RPC candidate is installed NEXT by the disposable CI, then the
-- acceptance file creates its convenience caller. No mock replacement.
