-- DISPOSABLE PostgreSQL 17-only schema projection of 0001/0008/0053.
-- NOT a real Supabase migration. Verify these columns against canonical SQL.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Extension deliberately absent: test pg_catalog SHA-256 without pgcrypto.
create table public.workspaces(id uuid primary key);
create table public.workspace_branches(
 id uuid primary key,workspace_id uuid not null references public.workspaces(id),
 active boolean not null,unique(workspace_id,id));

-- V3 Attention Center minimal projection of canonical 0004.
-- A real installation MUST verify the live table schema and policies.
create type public.attention_severity as enum ('INFO','WARNING','CRITICAL');
create type public.attention_status as enum ('OPEN','ACKNOWLEDGED','RESOLVED');
create table public.attention_items(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 type text not null,resource_type text not null,resource_id uuid not null,
 severity public.attention_severity not null,
 status public.attention_status not null default 'OPEN',
 summary text not null,owner_user_id uuid,due_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id));
create unique index attention_open_dedupe_idx
 on public.attention_items(workspace_id,type,resource_type,resource_id)
 where status='OPEN';
alter table public.attention_items enable row level security;
revoke all on public.attention_items from public,anon,authenticated;
grant select,insert on public.attention_items to service_role;

create table public.requests(
 id uuid primary key,workspace_id uuid not null references public.workspaces(id),
 branch_id uuid not null,customer_id uuid,status text not null,
 version bigint not null,created_at timestamptz not null,
 unique(workspace_id,id),
 foreign key(workspace_id,branch_id) references public.workspace_branches(workspace_id,id));
create table public.conversations(
 id uuid primary key,workspace_id uuid not null,branch_id uuid not null,
 request_id uuid,customer_id uuid,unique(workspace_id,id),
 foreign key(workspace_id,request_id) references public.requests(workspace_id,id),
 foreign key(workspace_id,branch_id) references public.workspace_branches(workspace_id,id));
create table public.messages(
 id uuid primary key,workspace_id uuid not null,conversation_id uuid not null,
 direction text not null, sender_kind text not null,created_at timestamptz not null,
 unique(workspace_id,id),
 foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id));
grant usage on schema public to service_role;
grant select on public.workspaces,public.workspace_branches,public.conversations,
 public.messages to service_role;
grant select,update on public.requests to service_role;
-- Fixed IDs are fictional and not any connected tenant.
insert into public.workspaces values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_branches values
 ('11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.requests values
 ('33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '88888888-8888-4888-8888-888888888888',
  'NEW',1,clock_timestamp()-interval '3 hours'),
 ('44444444-4444-4444-8444-444444444444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  '99999999-9999-4999-8999-999999999999',
  'NEW',1,clock_timestamp()-interval '3 hours');
insert into public.conversations values
 ('55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '88888888-8888-4888-8888-888888888888'),
 ('66666666-6666-4666-8666-666666666666',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  '99999999-9999-4999-8999-999999999999');
insert into public.messages values
 ('77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  'INBOUND','CUSTOMER',clock_timestamp()-interval '2 hours'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '66666666-6666-4666-8666-666666666666',
  'INBOUND','CUSTOMER',clock_timestamp()-interval '2 hours');
-- Parameter construction mirrors the exact fixed adapter shape.
create function public.f15_fixture_claim_input(p_request uuid) returns jsonb
language sql stable as $$
 select pg_catalog.jsonb_build_object(
  'workspaceId',r.workspace_id,'branchId',r.branch_id,
  'requestId',r.id,'sourceVersion',r.version,
  'sourceLastInboundAt',m.created_at::text,
  'sourceLastInboundMessageId',m.id,
  'eventType','UNANSWERED_LEAD_SLA_REVIEW',
  'eventKey',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.replace(pg_catalog.json_build_array(
     'SONIC_F15_UNANSWERED_LEAD_SLA_V1',r.workspace_id::text,r.branch_id::text,
     r.id::text,m.id::text)::text,', ',','),'UTF8')),'hex'),
  'observedAt',pg_catalog.clock_timestamp()-interval '1 second',
  'dueAt',m.created_at+interval '30 minutes','thresholdMinutes',30,
  'transactionalSourceRecheckRequired',true,
  'uniqueEventKeyRequired',true,'requiresOwnerReview',true,
  'customerMessageAuthorized',false,'financialMutationAuthorized',false)
 from public.requests r join public.conversations c
 on c.workspace_id=r.workspace_id and c.request_id=r.id
 join public.messages m on m.workspace_id=c.workspace_id
 and m.conversation_id=c.id and m.direction='INBOUND'
 where r.id=p_request
 order by m.created_at desc,m.id desc limit 1;
$$;
revoke all on function public.f15_fixture_claim_input(uuid) from public,anon,authenticated;
grant execute on function public.f15_fixture_claim_input(uuid) to service_role;
