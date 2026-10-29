-- F15 real PostgreSQL 17 acceptance, disposable CI only.
\set ON_ERROR_STOP on
do $$
begin
 if has_table_privilege('anon','public.f15_unanswered_lead_reviews','SELECT')
    or has_table_privilege('authenticated','public.f15_unanswered_lead_reviews','INSERT')
    or has_function_privilege('anon',
      'public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.servicedesk_f15_lock_request(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)','EXECUTE')
    or not (select relrowsecurity from pg_catalog.pg_class
      where oid='public.f15_unanswered_lead_reviews'::regclass)
    or (select count(*) from pg_catalog.pg_policies where schemaname='public'
      and tablename='f15_unanswered_lead_reviews')<>0
 then raise exception 'F15_PRIVILEGED_LEDGER_ACL_RLS_VETO'; end if;
end $$;

-- Rollback never leaves even one source review recorded.
begin;
set local role service_role;
do $$
declare x jsonb;
begin
 x:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 if x->>'state'<>'INSERTED' then
  raise exception 'F15_ROLLBACK_PRECONDITION_FAIL: %',x;end if;
end $$;
rollback;
do $$
begin
 if (select count(*) from public.f15_unanswered_lead_reviews)<>0
 then raise exception 'F15_TRANSACTION_ROLLBACK_LEAK';end if;
end $$;

-- Forced ledger failure must not emit a successful source receipt.
alter table public.f15_unanswered_lead_reviews
 add constraint qa_f15_forced_fail check(request_id<>
   '33333333-3333-4333-8333-333333333333'::uuid);
set role service_role;
do $$
declare blocked boolean:=false;
begin
 begin
  perform public.servicedesk_claim_f15_unanswered_lead_sla_review(
    public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 exception when check_violation then blocked:=true;
 end;
 if not blocked then raise exception 'F15_DB_LEDGER_FAILURE_WAS_SWALLOWED';end if;
end $$;
reset role;
alter table public.f15_unanswered_lead_reviews drop constraint qa_f15_forced_fail;
do $$
begin
 if (select count(*) from public.f15_unanswered_lead_reviews)<>0
 then raise exception 'F15_FORCED_DB_FAILURE_LEFT_ROWS';end if;
end $$;

-- One durable source event, and a second replay is NOT another insertion.
set role service_role;
do $$
declare first jsonb; replay jsonb; tenant_b jsonb;
begin
 first:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 replay:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 tenant_b:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('44444444-4444-4444-8444-444444444444'));
 if first->>'state'<>'INSERTED' or first->>'savedRowsInserted'<>'1'
    or first->>'transactionCommitted'<>'true'
    or first->>'sourceRecheckedUnderLock'<>'true'
    or first->>'uniqueEventKeyEnforced'<>'true'
    or first->>'externalSideEffects'<>'false'
    or replay->>'state'<>'ALREADY_RECORDED'
    or replay->>'savedRowsInserted'<>'0'
    or tenant_b->>'state'<>'INSERTED'
 then raise exception 'F15_INSERT_REPLAY_TWO_TENANT_FAILED %,%,%',first,replay,tenant_b;end if;
end $$;
reset role;
do $$
begin
 if (select count(*) from public.f15_unanswered_lead_reviews)<>2
    or (select count(distinct workspace_id)
      from public.f15_unanswered_lead_reviews)<>2
 then raise exception 'F15_TENANT_REPLAY_DUPLICATE';end if;
end $$;

-- DB must not trust human-supplied eventKey, version, scope, or action flags.
set role service_role;
do $$
declare valid jsonb; x jsonb;
begin
 valid:=public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333');
 for x in
  select jsonb_set(valid,'{eventKey}',to_jsonb(repeat('0',64))) union all
  select jsonb_set(valid,'{sourceVersion}','2'::jsonb) union all
  select jsonb_set(valid,'{sourceVersion}','1.5'::jsonb) union all
  select jsonb_set(valid,'{thresholdMinutes}','30.5'::jsonb) union all
  select jsonb_set(valid,'{branchId}',to_jsonb('22222222-2222-4222-8222-222222222222'::text)) union all
  select jsonb_set(valid,'{customerMessageAuthorized}','true'::jsonb) union all
  select jsonb_set(valid,'{thresholdMinutes}','10'::jsonb) union all
  select jsonb_set(valid,'{sourceLastInboundMessageId}',
     to_jsonb('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::text)) union all
  select valid||'{"rawCustomerEmail":"private@example.invalid"}'::jsonb
 loop
  if public.servicedesk_claim_f15_unanswered_lead_sla_review(x)->>'state'
    in ('INSERTED','ALREADY_RECORDED') then
   raise exception 'F15_FORGED_EVENT_SUCCESS %',x;
  end if;
 end loop;
end $$;
reset role;

-- Distinct simultaneous inbound message IDs may share the same timestamp.
insert into public.messages
 select 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,m.workspace_id,
        m.conversation_id,m.direction,m.sender_kind,m.created_at
 from public.messages m where m.id='77777777-7777-4777-8777-777777777777';
set role service_role;
do $$
declare x jsonb;
begin
 x:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 if x->>'state'<>'INSERTED' or
   x->>'sourceLastInboundMessageId'<>'ffffffff-ffff-4fff-8fff-ffffffffffff'
 then raise exception 'F15_SAME_TIMESTAMP_MESSAGE_ID_COLLISION %',x;end if;
end $$;
reset role;
do $$
begin
 if (select count(*) from public.f15_unanswered_lead_reviews
  where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>2
 then raise exception 'F15_SAME_TIME_BOTH_MESSAGES_NOT_RECORDED';end if;
end $$;

-- A saved staff response after the inbound prevents another candidate.
insert into public.messages values
 ('12121212-1212-4212-8212-121212121212',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555','OUTBOUND','STAFF',
  clock_timestamp()-interval '1 hour');
set role service_role;
do $$
declare x jsonb;
begin
 x:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
  public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 if x->>'code'<>'F15_NOT_DUE_OR_ANSWERED'
 then raise exception 'F15_REAL_STAFF_REPLY_NOT_ENFORCED %',x;end if;
end $$;
reset role;

-- Same-customer conversation in ANOTHER branch still invalidates proof.
insert into public.workspace_branches values
 ('29292929-2929-4929-8929-292929292929',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.conversations values
 ('14141414-1414-4414-8414-141414141414',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '29292929-2929-4929-8929-292929292929',null,
  '99999999-9999-4999-8999-999999999999');
set role service_role;
do $$
declare x jsonb;
begin
 x:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
  public.f15_fixture_claim_input('44444444-4444-4444-8444-444444444444'));
 if x->>'code'<>'F15_RESPONSE_HISTORY_AMBIGUOUS'
 then raise exception 'F15_UNLINKED_REPLY_HISTORY_IGNORED %',x;end if;
end $$;
reset role;

-- Saved request status/version transitions immediately invalidate source CAS.
update public.requests set status='QUOTED',version=version+1
 where id='33333333-3333-4333-8333-333333333333';
set role service_role;
do $$
declare x jsonb;
begin
 x:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
  public.f15_fixture_claim_input('33333333-3333-4333-8333-333333333333'));
 if x->>'code'<>'F15_SOURCE_CHANGED'
 then raise exception 'F15_SAVED_TERMINAL_STATUS_IGNORED %',x;end if;
end $$;
reset role;

select 'PG17_F15_ATOMIC_TWO_TENANT_ROLLBACK_ADVERSARIAL_PASS' as receipt;
