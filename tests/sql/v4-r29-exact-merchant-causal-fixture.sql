-- CRITIC-01 R29 / disposable PostgreSQL17 ONLY. All records fictional.
-- Empty, isolated database: no real Supabase, no customer identifiers.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.requests (
 id uuid primary key, workspace_id uuid not null, branch_id uuid not null
);
create table public.quotes (
 id uuid primary key, workspace_id uuid not null, request_id uuid not null,
 status text not null, accepted_at timestamptz, superseded_by uuid,
 total_minor integer not null, currency text not null
);
create table public.invoices (
 id uuid primary key, workspace_id uuid not null, quote_id uuid,
 total_minor bigint not null, currency text not null
);
create table public.workflow_rule_versions (
 id uuid primary key, workspace_id uuid not null, branch_id uuid not null, event_type text
);
create table public.workflow_executions (
 id uuid primary key, workspace_id uuid not null, branch_id uuid not null,
 rule_version_id uuid not null, mode text, event_type text, matched boolean,
 recursion_depth integer, execution_key text
);
create table public.workflow_action_executions (
 id uuid primary key, workspace_id uuid not null, branch_id uuid not null,
 execution_id uuid not null, action_type text, state text
);
create table public.attention_items (
 id uuid primary key, workspace_id uuid not null, resource_type text,
 resource_id uuid not null, type text
);
-- Two workspaces with separate branches, invoices and accepted quotes.
insert into public.requests values
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b1000000-0000-4000-8000-000000000001');
insert into public.quotes values
 ('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001','ACCEPTED','2026-10-17T12:00:00Z',null,20000,'USD'),
 ('20000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000002','ACCEPTED','2026-10-17T12:00:00Z',null,12000,'USD');
insert into public.invoices values
 ('30000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000001',20000,'USD'),
 ('30000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000002',12000,'USD');
insert into public.workflow_rule_versions values
 ('40000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','QUOTE_ACCEPTED'),
 ('40000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b1000000-0000-4000-8000-000000000001','QUOTE_ACCEPTED');
insert into public.workflow_executions values
 ('50000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'a1000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001','LIVE','QUOTE_ACCEPTED',true,0,
 'live:40000000-0000-4000-8000-000000000001:' ||
 encode(extensions.digest(concat_ws('|',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'a1000000-0000-4000-8000-000000000001','QUOTE_ACCEPTED',
 '20000000-0000-4000-8000-000000000001','0',''
 ),'sha256'),'hex')),
 -- B has unrelated execution linked to a fictional *non-quote* source.
 ('50000000-0000-4000-8000-000000000002',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'b1000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000002','LIVE','QUOTE_ACCEPTED',true,0,
 'live:40000000-0000-4000-8000-000000000002:' ||
 encode(extensions.digest(concat_ws('|',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'b1000000-0000-4000-8000-000000000001','QUOTE_ACCEPTED',
 '99999999-9999-4999-8999-999999999999','0',''
 ),'sha256'),'hex'));
insert into public.workflow_action_executions values
 ('60000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a1000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','CREATE_ATTENTION','SUCCEEDED'),
 ('60000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'b1000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','CREATE_ATTENTION','SUCCEEDED');
insert into public.attention_items values
 ('70000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'workflow_execution','50000000-0000-4000-8000-000000000001','WORKFLOW_RULE'),
 ('70000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'workflow_execution','50000000-0000-4000-8000-000000000002','WORKFLOW_RULE');
