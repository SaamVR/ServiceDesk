\set ON_ERROR_STOP on
-- This SQL runs after 0053's exact extracted historical function has been
-- installed against seven fixtures and after 0062 replaces its body.
-- It intentionally exercises real PG execution (not source string matching).
create function public.qa_expect_rejected(p_sql text, p_code text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if SQLERRM = p_code then return; end if;
    raise exception 'Wrong denial: expected %, got %',p_code,SQLERRM;
  end;
  raise exception 'Unsafe mutation succeeded; expected %',p_code;
end;
$$;

insert into public.properties(id,workspace_id,branch_id) values
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
 ('10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222'),
 ('10000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);

insert into public.requests(id,workspace_id,branch_id,property_id) values
 ('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'10000000-0000-4000-8000-000000000002');

insert into public.conversations(id,workspace_id,branch_id,request_id) values
 ('30000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'20000000-0000-4000-8000-000000000001');

insert into public.crews(id,workspace_id,branch_id) values
 ('40000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
 ('40000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');

insert into public.capacity_slots(id,workspace_id,branch_id,crew_id) values
 ('50000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'40000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'40000000-0000-4000-8000-000000000002');

insert into public.visits(id,workspace_id,branch_id,request_id,crew_id,slot_id) values
 ('60000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001');

insert into public.recurrence_rules(id,workspace_id,branch_id,request_id,property_id) values
 ('70000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001');

do $$
declare p integer;
begin
  select count(*) into p from pg_trigger
    where tgname in ('properties_branch_guard','requests_branch_guard',
      'conversations_branch_guard','crews_branch_guard',
      'capacity_slots_branch_guard','visits_branch_guard',
      'recurrence_rules_branch_guard') and not tgisinternal;
  if p <> 7 then raise exception 'Original seven trigger bindings lost: %',p; end if;
  if (select branch_id from public.properties where id='10000000-0000-4000-8000-000000000001')
     <> '11111111-1111-4111-8111-111111111111'::uuid
     or (select branch_id from public.requests where id='20000000-0000-4000-8000-000000000002')
     <> '22222222-2222-4222-8222-222222222222'::uuid
     or (select branch_id from public.conversations where id='30000000-0000-4000-8000-000000000001')
     <> '11111111-1111-4111-8111-111111111111'::uuid
     or (select branch_id from public.crews where id='40000000-0000-4000-8000-000000000001')
     <> '11111111-1111-4111-8111-111111111111'::uuid
     or (select branch_id from public.capacity_slots where id='50000000-0000-4000-8000-000000000002')
     <> '22222222-2222-4222-8222-222222222222'::uuid
     or (select branch_id from public.visits where id='60000000-0000-4000-8000-000000000001')
     <> '11111111-1111-4111-8111-111111111111'::uuid
     or (select branch_id from public.recurrence_rules where id='70000000-0000-4000-8000-000000000001')
     <> '11111111-1111-4111-8111-111111111111'::uuid
   then raise exception 'Default or related-branch derivation was incorrect'; end if;
end $$;

-- These must fail with exact branch-scope errors, NOT SQLSTATE 42703.
select public.qa_expect_rejected($t$
insert into public.properties values
 ('80000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '44444444-4444-4444-8444-444444444444')
$t$,'BRANCH_NOT_AVAILABLE');

select public.qa_expect_rejected($t$
insert into public.requests values
 ('80000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000002')
$t$,'REQUEST_PROPERTY_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.conversations values
 ('80000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  '20000000-0000-4000-8000-000000000001')
$t$,'CONVERSATION_REQUEST_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.capacity_slots values
 ('80000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '40000000-0000-4000-8000-000000000002')
$t$,'CAPACITY_CREW_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.visits values
 ('80000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  '20000000-0000-4000-8000-000000000001',null,null)
$t$,'VISIT_REQUEST_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.visits values
 ('80000000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',null)
$t$,'VISIT_CREW_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.visits values
 ('80000000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '20000000-0000-4000-8000-000000000001',
  null,'50000000-0000-4000-8000-000000000002')
$t$,'VISIT_SLOT_BRANCH_MISMATCH');

select public.qa_expect_rejected($t$
insert into public.recurrence_rules values
 ('80000000-0000-4000-8000-000000000008','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002')
$t$,'RECURRENCE_BRANCH_MISMATCH');

-- Cross-tenant branch ID cannot be selected even if the branch itself is active.
select public.qa_expect_rejected($t$
insert into public.properties values
 ('80000000-0000-4000-8000-000000000009','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333')
$t$,'BRANCH_NOT_AVAILABLE');

-- UPDATE must keep the same branch contract as INSERT.
select public.qa_expect_rejected($t$
update public.requests set branch_id='11111111-1111-4111-8111-111111111111'
 where id='20000000-0000-4000-8000-000000000002'
$t$,'REQUEST_PROPERTY_BRANCH_MISMATCH');

do $$
begin
 if (select prosecdef from pg_proc where oid=
    'public.servicedesk_apply_branch_defaults_and_consistency()'::regprocedure) then
   raise exception 'Shared row-type guard unexpectedly changed to SECURITY DEFINER';
 end if;
end $$;
select 'PG17_BRANCH_ROWTYPE_REPAIR_PASS' as receipt;
