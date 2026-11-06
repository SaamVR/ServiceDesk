-- Disposable PG17 F26 ASSIGN transaction test. FICTIONAL UUIDs, NO Supabase.
-- Do not connect this to a live/project database.
create schema if not exists public;
do $roles$
begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end;
$roles$;
create type public.membership_role as enum ('OWNER','DISPATCHER','CREW');
create type public.membership_status as enum ('INVITED','ACTIVE','REVOKED');
create type public.visit_status as enum ('SCHEDULED','ASSIGNED','EN_ROUTE','IN_PROGRESS','NEEDS_REVIEW','COMPLETED','CANCELLED');
create table public.memberships (
 workspace_id uuid not null,user_id uuid not null,
 role public.membership_role not null,status public.membership_status not null,
 primary key(workspace_id,user_id)
);
create table public.requests (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null
);
create table public.crews (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 active boolean not null default true
);
create table public.crew_members (
 id uuid primary key,workspace_id uuid not null,crew_id uuid not null,
 user_id uuid not null,active boolean not null default true
);
create table public.capacity_slots (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 crew_id uuid not null
);
create table public.quotes (
 id uuid primary key,workspace_id uuid not null,
 duration_minutes integer not null,buffer_minutes integer not null
);
create table public.visits (
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 request_id uuid not null,quote_id uuid not null,
 crew_id uuid,slot_id uuid,hold_id uuid,
 status public.visit_status not null default 'SCHEDULED',
 version bigint not null default 1,
 starts_at timestamptz not null,ends_at timestamptz not null,
 timezone text not null default 'UTC',updated_at timestamptz not null default now()
);
create table public.visit_evidence (
 workspace_id uuid not null,visit_id uuid not null,kind text not null
);
create table public.outbox_events (
 id uuid primary key,workspace_id uuid not null,topic text not null,
 payload jsonb not null,status text not null,attempts integer not null,
 idempotency_key text not null,created_at timestamptz not null,updated_at timestamptz not null,
 unique(workspace_id,idempotency_key)
);
insert into public.requests values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.crews values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.capacity_slots values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.quotes values
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',120,30);
insert into public.visits values
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '33333333-3333-4333-8333-333333333333',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null,
 'SCHEDULED',1,'2027-01-11T10:00:00Z','2027-01-11T12:30:00Z','UTC',now());
insert into public.memberships values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','OWNER','ACTIVE'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','CREW','ACTIVE');
insert into public.crew_members values
 ('99999999-9999-4999-8999-999999999999',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '22222222-2222-4222-8222-222222222222',true);
