-- Source-only F26 OWNER revocation/auth identity acceptance on fictional PG17.
-- Run AFTER existing F26 acceptance (which defines sd_f26_rpc_assign).
-- No changes to real Supabase and no provider/booking/customer actions.
\set ON_ERROR_STOP on
update public.visits set status='SCHEDULED',version=1
 where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
delete from public.outbox_events;
update public.memberships set status='ACTIVE',role='OWNER'
 where user_id='11111111-1111-4111-8111-111111111111';
update public.memberships set status='ACTIVE',role='CREW'
 where user_id='22222222-2222-4222-8222-222222222222';

-- Historical 0011 must be service_role EXECUTE only, including candidate.
do $$
begin
 if has_function_privilege('anon','public.servicedesk_transition_visit(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.servicedesk_transition_visit(jsonb)','EXECUTE')
 or not has_function_privilege('service_role','public.servicedesk_transition_visit(jsonb)','EXECUTE') then
  raise exception 'F26_VISIT_RPC_SERVICE_ROLE_ONLY_ACL_MISMATCH'; end if;
end $$;

set role authenticated;
do $$
begin
 perform public.sd_f26_rpc_assign();
 raise exception 'F26_AUTHENTICATED_DEFAULT_RPC_EXECUTE_ALLOWED';
exception when insufficient_privilege then null;
end $$;
reset role;
set role anon;
do $$
begin
 perform public.sd_f26_rpc_assign();
 raise exception 'F26_ANON_DEFAULT_RPC_EXECUTE_ALLOWED';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Only in this disposable fixture, widen RPC EXECUTE to test JWT fallback.
grant execute on function public.servicedesk_transition_visit(jsonb) to anon, authenticated;

-- A CREW JWT claiming the OWNER UUID must be denied before access to
-- the visit table. PostgreSQL authenticates only a fictional GUC here,
-- so this tests the server-side identity predicate, not real token signing.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'code'<>'FORBIDDEN' then
   raise exception 'F26_AUTHENTICATED_OWNER_ID_SPOOF_ALLOWED %',r;end if;
end $$;
reset role;
set role anon;
do $$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'code'<>'FORBIDDEN' then
   raise exception 'F26_ANON_OWNER_ID_SPOOF_ALLOWED %',r;end if;
end $$;
reset role;
revoke execute on function public.servicedesk_transition_visit(jsonb) from anon, authenticated;

do $$
begin
 if has_function_privilege('anon','public.servicedesk_transition_visit(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.servicedesk_transition_visit(jsonb)','EXECUTE') then
  raise exception 'F26_RPC_TEST_ACL_RESTORATION_FAILED'; end if;
end $$;

-- The trusted backend role is permitted to call but must be refused
-- if the actual saved OWNER membership is revoked or its role is changed.
update public.memberships set status='REVOKED'
 where user_id='11111111-1111-4111-8111-111111111111';
do $$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'code'<>'FORBIDDEN' then
   raise exception 'F26_REVOKED_OWNER_ASSIGNED %',r;end if;
end $$;
update public.memberships set status='ACTIVE',role='CREW'
 where user_id='11111111-1111-4111-8111-111111111111';
do $$
declare r jsonb;
begin
 r:=public.sd_f26_rpc_assign();
 if r->>'code'<>'FORBIDDEN' then
   raise exception 'F26_OWNER_ROLE_CHANGED_ASSIGNED %',r;end if;
end $$;
update public.memberships set role='OWNER'
 where user_id='11111111-1111-4111-8111-111111111111';

do $$
begin
 if (select status from public.visits
     where id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>'SCHEDULED'
 or (select version from public.visits
     where id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>1
 or (select count(*) from public.outbox_events)<>0 then
   raise exception 'F26_OWNER_AUTH_DENIAL_LEFT_VISIT_OUTBOX_WRITE';end if;
end $$;
select 'PG17_F26_OWNER_AUTHZ_SPOOF_REVOKE_NO_WRITE_PASS' as receipt;
