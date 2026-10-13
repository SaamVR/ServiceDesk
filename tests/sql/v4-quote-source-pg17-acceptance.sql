-- Real PostgreSQL 17 rehearsal. Runs only against disposable CI service.
\set ON_ERROR_STOP on
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_feature_flags(workspace_id,feature_key,enabled)
 values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AUTO_INTERNAL_QUOTE_ACCEPTED',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','AUTO_INTERNAL_QUOTE_ACCEPTED',false);
insert into public.quotes(id,workspace_id,status) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SENT'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SENT'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SENT'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SENT');

-- Source capture is atomic, scoped and idempotent.
update public.quotes set status='ACCEPTED'
 where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
update public.quotes set status='ACCEPTED'
 where id='11111111-1111-4111-8111-111111111111';
do $$
begin
 if (select count(*) from public.workflow_source_events)<>1 then
   raise exception 'Expected exactly one opted-in accepted-quote source event';
 end if;
 if (select count(*) from public.workflow_source_events
     where quote_id='22222222-2222-4222-8222-222222222222')<>0 then
   raise exception 'Opted-out tenant emitted an internal source event';
 end if;
 if (select state from public.workflow_source_events
     where quote_id='11111111-1111-4111-8111-111111111111')<>'PENDING' then
   raise exception 'Initial internal event was not pending';
 end if;
end $$;

-- An aborted quote transaction also aborts the source journal row.
begin;
update public.quotes set status='ACCEPTED'
 where id='33333333-3333-4333-8333-333333333333';
do $$
begin
 if (select count(*) from public.workflow_source_events)<>2 then
   raise exception 'No source event in the same quote-accept transaction';
 end if;
end $$;
rollback;
do $$
begin
 if (select status from public.quotes where id='33333333-3333-4333-8333-333333333333')<>'SENT'
   or (select count(*) from public.workflow_source_events)<>1 then
  raise exception 'Rollback left a quote or source journal partially committed';
 end if;
end $$;

-- Deliberately force a journal insert failure; the quote must stay SENT.
alter table public.workflow_source_events add constraint qa_forced_source_failure
 check (quote_id <> '44444444-4444-4444-8444-444444444444'::uuid);
do $$
declare was_rejected boolean:=false;
begin
 begin
  update public.quotes set status='ACCEPTED'
   where id='44444444-4444-4444-8444-444444444444';
 exception when check_violation then
  was_rejected:=true;
 end;
 if not was_rejected then
   raise exception 'Acceptance succeeded even though atomic journal insert failed';
 end if;
 if (select status from public.quotes where id='44444444-4444-4444-8444-444444444444') <> 'SENT' then
  raise exception 'Acceptance partially committed after journal error';
 end if;
end $$;
alter table public.workflow_source_events drop constraint qa_forced_source_failure;

-- Client roles cannot inspect or mutate internal ledger or claim/complete leases.
do $$
begin
 if has_table_privilege('anon','public.workflow_source_events','SELECT')
    or has_table_privilege('authenticated','public.workflow_source_events','INSERT')
    or has_table_privilege('authenticated','public.workflow_source_events','UPDATE')
    or has_function_privilege('anon',
        'public.servicedesk_claim_quote_source_events(text,integer)','EXECUTE')
    or has_function_privilege('authenticated',
        'public.servicedesk_complete_quote_source_event(uuid,text,text,text)','EXECUTE') then
    raise exception 'Internal source ledger exposed to client roles';
 end if;
 if not has_function_privilege('service_role',
        'public.servicedesk_claim_quote_source_events(text,integer)','EXECUTE') then
    raise exception 'Trusted server cannot claim lease';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.workflow_source_events'::regclass) then
    raise exception 'RLS not enabled';
 end if;
 if (select count(*) from pg_policies where schemaname='public'
        and tablename='workflow_source_events') <> 0 then
    raise exception 'Internal source rows became readable through a client policy';
 end if;
end $$;

-- All lease RPCs are executed as isolated service_role, never as client role.
set role service_role;
do $$
declare row_data public.workflow_source_events%rowtype;
begin
 select * into row_data from public.servicedesk_claim_quote_source_events('worker_A_0101',1);
 if row_data.quote_id is distinct from '11111111-1111-4111-8111-111111111111'
    or row_data.state <> 'PROCESSING' or row_data.attempts <> 1 then
    raise exception 'First trusted worker did not claim pending record';
 end if;
end $$;
reset role;

-- The first worker crashes; a second worker can claim the expired lease.
update public.workflow_source_events set locked_until=now()-interval '1 minute'
 where quote_id='11111111-1111-4111-8111-111111111111';
set role service_role;
do $$
declare row_data public.workflow_source_events%rowtype;
declare wrong_ack jsonb;
declare proper_ack jsonb;
begin
 select * into row_data from public.servicedesk_claim_quote_source_events('worker_B_0101',1);
 if row_data.attempts <> 2 or row_data.locked_by <> 'worker_B_0101' then
   raise exception 'Expired event was not safely reclaimed';
 end if;
 wrong_ack:=public.servicedesk_complete_quote_source_event(row_data.id,'worker_A_0101','SUCCEEDED');
 if wrong_ack->>'code' <> 'QUOTE_SOURCE_LEASE_UNVERIFIED' then
   raise exception 'Old worker was able to acknowledge a stolen lease';
 end if;
 proper_ack:=public.servicedesk_complete_quote_source_event(
   row_data.id,'worker_B_0101','FAILED','QUOTE_SOURCE_REPLAY_EXCEPTION');
 if proper_ack->>'state' <> 'RETRY_PENDING' then
   raise exception 'Failed event not requeued for backoff';
 end if;
end $$;
reset role;
do $$
begin
 if (select locked_by from public.workflow_source_events
     where quote_id='11111111-1111-4111-8111-111111111111') is not null
     or (select next_attempt_at > now() from public.workflow_source_events
       where quote_id='11111111-1111-4111-8111-111111111111') is distinct from true
 then
    raise exception 'Retry did not clear lock or schedule backoff';
 end if;
end $$;
update public.workflow_source_events set next_attempt_at=now()-interval '1 second'
 where quote_id='11111111-1111-4111-8111-111111111111';
set role service_role;
do $$
declare row_data public.workflow_source_events%rowtype;
declare ack jsonb;
begin
 select * into row_data from public.servicedesk_claim_quote_source_events('worker_C_0101',1);
 if row_data.attempts <> 3 then raise exception 'Retry number incorrect'; end if;
 ack:=public.servicedesk_complete_quote_source_event(row_data.id,'worker_C_0101','SUCCEEDED');
 if ack->>'state'<>'SUCCEEDED' then raise exception 'Completion acknowledgement not durable'; end if;
end $$;
reset role;

-- Separate quote: test max-attempt dead letter after a lease expires.
update public.quotes set status='ACCEPTED'
 where id='33333333-3333-4333-8333-333333333333';
update public.workflow_source_events set attempts=7
 where quote_id='33333333-3333-4333-8333-333333333333';
set role service_role;
do $$
declare row_data public.workflow_source_events%rowtype;
begin
 select * into row_data from public.servicedesk_claim_quote_source_events('worker_D_0101',1);
 if row_data.attempts<>8 then raise exception 'Last allowable claim was denied'; end if;
end $$;
reset role;
update public.workflow_source_events set locked_until=now()-interval '1 second'
 where quote_id='33333333-3333-4333-8333-333333333333';
set role service_role;
do $$
declare row_data public.workflow_source_events%rowtype;
begin
 select * into row_data from public.servicedesk_claim_quote_source_events('worker_E_0101',1);
 if found then raise exception 'Final expired lease was claimed a ninth time'; end if;
end $$;
reset role;
do $$
begin
 if not exists (select 1 from public.workflow_source_events
    where quote_id='33333333-3333-4333-8333-333333333333'
      and state='DEAD_LETTER' and attempts=8
      and locked_by is null and last_error_code='LEASE_EXPIRED_MAX_ATTEMPTS') then
   raise exception 'Final expired lease did not transition to dead letter';
 end if;
end $$;

select 'PG17_INTERNAL_QUOTE_SOURCE_MIGRATION_PASS' as exact_test_status;
