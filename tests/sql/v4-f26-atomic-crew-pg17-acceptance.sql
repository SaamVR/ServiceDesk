-- F26 disposable PostgreSQL 17 acceptance against ORIGINAL 0011 visit RPC
-- plus SOURCE-ONLY reviewed F26 before-assignment row-lock trigger.
-- Never execute against a connected Supabase project.
do $version$
begin
 if current_setting('server_version_num')::int < 170000 then
  raise exception 'F26_REQUIRES_DISPOSABLE_PG17';
 end if;
end;
$version$;

do $acl$
begin
 if has_function_privilege('anon','public.servicedesk_f26_guard_assigned_crew()','EXECUTE')
 or has_function_privilege('authenticated','public.servicedesk_f26_guard_assigned_crew()','EXECUTE') then
  raise exception 'F26_GUARD_EXECUTE_PRIVILEGE_EXPOSED';
 end if;
 if not exists(select 1 from pg_trigger t
  where t.tgrelid='public.visits'::regclass
    and t.tgname='zz_servicedesk_f26_assigned_crew_guard'
    and t.tgenabled='O') then
   raise exception 'F26_TRIGGER_NOT_INSTALLED_IN_DISPOSABLE';
 end if;
end;
$acl$;

-- Real 0011 RPC invocation; the fixture gives a valid OWNER and
-- an ACTIVE CREW member in the exact same branch.
create or replace function public.sd_f26_rpc_assign() returns jsonb
language sql as $function$
 select public.servicedesk_transition_visit(jsonb_build_object(
  'workspaceId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'actorRole','OWNER',
  'actorUserId','11111111-1111-4111-8111-111111111111',
  'visitId','ffffffff-ffff-4fff-8fff-ffffffffffff',
  'action','ASSIGN',
  'expectedVersion',1,
  'now','2026-11-06T11:00:00Z'
 ))
$function$;

-- Exception must come from the actual DB trigger. No app mock and no
-- mere refusal from a simplified substitute RPC.
create or replace function public.sd_f26_assert_blocked(label text)
returns void
language plpgsql as $function$
declare v_rejected boolean:=false;v_result jsonb;
begin
 begin
  v_result := public.sd_f26_rpc_assign();
 exception when check_violation then
  v_rejected:=true;
 end;
 if not v_rejected then
  raise exception 'F26_UNSAFE_ASSIGN_ALLOWED: %; result=%',label,v_result;
 end if;
 if (select status from public.visits
       where id='ffffffff-ffff-4fff-8fff-ffffffffffff') <> 'SCHEDULED'
 or (select version from public.visits
       where id='ffffffff-ffff-4fff-8fff-ffffffffffff') <> 1
 or (select count(*) from public.outbox_events) <> 0 then
  raise exception 'F26_REJECTED_ASSIGN_CHANGED_VISIT_OR_OUTBOX: %',label;
 end if;
end;
$function$;

-- Revoked member (no longer crew role).
update public.memberships set status='REVOKED'
where user_id='22222222-2222-4222-8222-222222222222';
select public.sd_f26_assert_blocked('revoked membership');
update public.memberships set status='ACTIVE'
where user_id='22222222-2222-4222-8222-222222222222';

-- Crew membership role changed to dispatcher.
update public.memberships set role='DISPATCHER'
where user_id='22222222-2222-4222-8222-222222222222';
select public.sd_f26_assert_blocked('wrong crew role');
update public.memberships set role='CREW'
where user_id='22222222-2222-4222-8222-222222222222';

-- Crew becomes inactive.
update public.crews set active=false
where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select public.sd_f26_assert_blocked('inactive crew');
update public.crews set active=true
where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

-- Crew member revoked independently from the workspace membership.
update public.crew_members set active=false
where id='99999999-9999-4999-8999-999999999999';
select public.sd_f26_assert_blocked('revoked crew membership');
update public.crew_members set active=true
where id='99999999-9999-4999-8999-999999999999';

-- Cross-branch resource mismatches.
update public.crews set branch_id='bbbbbbbb-bbbb-4bbb-8bbb-111111111111'
where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select public.sd_f26_assert_blocked('foreign crew branch');
update public.crews set branch_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

update public.requests set branch_id='bbbbbbbb-bbbb-4bbb-8bbb-111111111111'
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select public.sd_f26_assert_blocked('foreign request branch');
update public.requests set branch_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

update public.capacity_slots set crew_id='dddddddd-dddd-4ddd-8ddd-111111111111'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
select public.sd_f26_assert_blocked('wrong slot crew');
update public.capacity_slots set crew_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

-- A direct UPDATE, bypassing the original RPC, must also fail.
update public.crew_members set active=false
where id='99999999-9999-4999-8999-999999999999';
do $direct$
declare blocked boolean:=false;
begin
 begin
  update public.visits set status='ASSIGNED'
  where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
 exception when check_violation then
  blocked:=true;
 end;
 if not blocked then
  raise exception 'F26_DIRECT_SQL_BYPASSED_ASSIGNED_CREW_TRIGGER';
 end if;
end;
$direct$;
update public.crew_members set active=true
where id='99999999-9999-4999-8999-999999999999';

-- Positive reference: the REAL original visit RPC remains fully compatible.
do $positive$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'ok' <> 'true' or r#>>'{visit,status}' <> 'ASSIGNED' or
    (select status from public.visits where
     id='ffffffff-ffff-4fff-8fff-ffffffffffff') <> 'ASSIGNED'
    or (select version from public.visits where
     id='ffffffff-ffff-4fff-8fff-ffffffffffff') <> 2
    or (select count(*) from public.outbox_events
        where topic='calendar.visit.upsert') <> 1 then
  raise exception 'F26_VALID_ASSIGN_REGRESSION: %',r;
 end if;
end;
$positive$;

-- Same-version replay refused by the ORIGINAL version lock.
do $replay$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'ok' <> 'false' or r->>'code' <> 'VERSION_CONFLICT'
    or (select count(*) from public.outbox_events) <> 1 then
  raise exception 'F26_ASSIGN_REPLAY_NOT_REJECTED: %',r;
 end if;
end;
$replay$;
select 'PG17_F26_ACTIVE_CREW_ATOMIC_ASSIGN_ACCEPTANCE_PASS' as receipt;
