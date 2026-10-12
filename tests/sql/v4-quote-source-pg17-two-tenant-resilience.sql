-- Disposable PostgreSQL 17 ONLY. Execute after:
--   v4-quote-source-pg17-fixture.sql
--   0063_v4_quote_accept_internal_source_journal.sql
--   v4-quote-source-pg17-acceptance.sql
-- This proves two independently opted-in tenants, a second queued event during
-- a lease crash, wrong-worker denial and terminal recovery. No provider sends.
\set ON_ERROR_STOP on

-- Existing acceptance left A's first event SUCCEEDED and third DEAD_LETTER;
-- B's initial accepted quote was opted out and must never be backfilled.
do $$
begin
 if (select count(*) from public.workflow_source_events) <> 2
    or (select count(*) from public.workflow_source_events where state='SUCCEEDED')<>1
    or (select count(*) from public.workflow_source_events where state='DEAD_LETTER')<>1
 then
    raise exception 'Two-tenant rehearsal requires completed base PG17 acceptance';
 end if;
end $$;

-- Explicit opt-in is tenant scoped, never retroactive to an earlier acceptance.
update public.workspace_feature_flags
 set enabled=true
 where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 and feature_key='AUTO_INTERNAL_QUOTE_ACCEPTED';

insert into public.quotes(id,workspace_id,status) values
 ('55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SENT'),
 ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SENT');
update public.quotes set status='ACCEPTED'
 where id in ('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666');
update public.quotes set status='ACCEPTED'
 where id='55555555-5555-4555-8555-555555555555';

do $$
begin
 if (select count(*) from public.workflow_source_events where state='PENDING')<>2
    or (select count(distinct workspace_id) from public.workflow_source_events where state='PENDING')<>2
    or (select count(*) from public.workflow_source_events
        where quote_id='22222222-2222-4222-8222-222222222222')<>0
 then
    raise exception 'Tenant-scoped capture, idempotency or no-backfill failed';
 end if;
end $$;

set role service_role;
do $$
declare
  row_data public.workflow_source_events%rowtype;
  claimed integer:=0;
  first_event uuid;
  second_event uuid;
  ack jsonb;
begin
 -- Both are eligible. Claim them together, then expire ONE intentionally:
 -- claiming limit 1 a second time need not prefer an expired lease over a
 -- different pending event, so do not bake that invalid ordering assumption in.
 for row_data in
   select * from public.servicedesk_claim_quote_source_events('qa_worker_initial_0101',2)
 loop
   if row_data.state<>'PROCESSING' or row_data.attempts<>1
      or row_data.locked_by<>'qa_worker_initial_0101' then
     raise exception 'Claim returned an unleased or incorrect event';
   end if;
   claimed:=claimed+1;
 end loop;
 if claimed<>2 then raise exception 'Expected two concurrently leased source events'; end if;
 select id into strict first_event from public.workflow_source_events
  where quote_id='66666666-6666-4666-8666-666666666666';
 select id into strict second_event from public.workflow_source_events
  where quote_id='55555555-5555-4555-8555-555555555555';

 update public.workflow_source_events set locked_until=now()-interval '1 minute'
  where id=first_event;
 ack:=public.servicedesk_complete_quote_source_event(first_event,'qa_worker_initial_0101','SUCCEEDED');
 if ack->>'code'<>'QUOTE_SOURCE_LEASE_UNVERIFIED' then
   raise exception 'Expired lease was acknowledged by prior owner';
 end if;

 select * into row_data from public.servicedesk_claim_quote_source_events('qa_worker_reclaim_0202',1);
 if row_data.id is distinct from first_event or row_data.attempts<>2
    or row_data.locked_by<>'qa_worker_reclaim_0202' then
   raise exception 'Interrupted source event not safely reclaimed';
 end if;
 ack:=public.servicedesk_complete_quote_source_event(first_event,'qa_worker_initial_0101','SUCCEEDED');
 if ack->>'code'<>'QUOTE_SOURCE_LEASE_UNVERIFIED' then
   raise exception 'Previous lease owner acknowledged a stolen lease';
 end if;
 ack:=public.servicedesk_complete_quote_source_event(first_event,'qa_worker_reclaim_0202','SUCCEEDED');
 if ack->>'state'<>'SUCCEEDED' then
   raise exception 'Reclaiming worker did not complete internal event';
 end if;

 -- The other event is still owned by its original worker. Crash it on its
 -- eighth attempt; the next claim must terminalize without attempt nine.
 update public.workflow_source_events
 set attempts=8,locked_until=now()-interval '1 minute'
 where id=second_event and state='PROCESSING'
   and locked_by='qa_worker_initial_0101';
 select * into row_data from public.servicedesk_claim_quote_source_events('qa_worker_terminal_0303',1);
 if row_data.id is not null then
   raise exception 'Over-limit expired event was claimed for a ninth attempt';
 end if;
 if not exists (
    select 1 from public.workflow_source_events
    where id=second_event and state='DEAD_LETTER' and attempts=8
      and locked_by is null and locked_until is null
      and last_error_code='LEASE_EXPIRED_MAX_ATTEMPTS'
 ) then raise exception 'Terminal expired lease was not dead-lettered'; end if;
end $$;
reset role;

do $$
begin
 if (select count(*) from public.workflow_source_events where state='SUCCEEDED')<>2
    or (select count(*) from public.workflow_source_events where state='DEAD_LETTER')<>2
    or (select count(*) from public.workflow_source_events where state in ('PENDING','PROCESSING','RETRY_PENDING'))<>0
 then raise exception 'Two-tenant recovery final tally unexpected'; end if;
end $$;
select 'PG17_TWO_TENANT_QUOTE_SOURCE_RESILIENCE_PASS' as exact_test_status;
