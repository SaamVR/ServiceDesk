-- Native PostgreSQL 17 F23 acceptance of REAL, UNAPPLIED hold release RPC.
-- Fixture only: PGHOST=127.0.0.1, PGDATABASE=sd_f23_disposable.
-- No connected Supabase, real owner, payment, visit or provider event.
\set ON_ERROR_STOP on
create or replace function public.sd_f23_release_fixture()
returns jsonb language sql security invoker set search_path=public,pg_temp as $$
 select public.servicedesk_release_held_slot_atomic(jsonb_build_object(
  'workspaceId','11111111-1111-4111-8111-111111111111',
  'actorUserId','77777777-7777-4777-8777-777777777777',
  'quoteId','33333333-3333-4333-8333-333333333333',
  'holdId','88888888-8888-4888-8888-888888888888',
  'slotId','55555555-5555-4555-8555-555555555555',
  'expiresAt','2100-01-02T00:00:00Z'
 ))
$$;
create or replace function public.sd_f23_expect_denied(label text,expected text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare out jsonb;
begin
 out:=public.sd_f23_release_fixture();
 if out->>'ok' is distinct from 'false' or out->>'code' is distinct from expected
 then raise exception 'F23_UNSAFE_RELEASE %: result=% expected=%',label,out,expected; end if;
 if (select status from public.slot_holds
     where id='88888888-8888-4888-8888-888888888888') <> 'HELD'
 then raise exception 'F23_REJECTED_CASE_MUTATED_HOLD: %',label; end if;
end;
$$;
do $acl$
begin
 if has_function_privilege('anon','public.servicedesk_release_held_slot_atomic(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.servicedesk_release_held_slot_atomic(jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.servicedesk_release_held_slot_atomic(jsonb)','EXECUTE')
 then raise exception 'F23_ATOMIC_RPC_SERVICE_ROLE_ONLY_ACL_MISMATCH'; end if;
end;
$acl$;
-- Even if an ACL were widened, SECURITY INVOKER must deny direct non-service.
grant execute on function public.servicedesk_release_held_slot_atomic(jsonb) to authenticated;
set role authenticated;
do $$ declare out jsonb;
begin
 out:=public.sd_f23_release_fixture();
 if out->>'code' is distinct from 'FORBIDDEN' then
  raise exception 'F23_UNTRUSTED_CALLER_ALLOWED %',out; end if;
end $$;
reset role;
revoke execute on function public.servicedesk_release_held_slot_atomic(jsonb) from authenticated;
-- Save the owner membership status; revocation must block before release.
update public.memberships set status='REVOKED'
 where user_id='77777777-7777-4777-8777-777777777777';
set role service_role;
select public.sd_f23_expect_denied('revoked_owner','FORBIDDEN');
reset role;
update public.memberships set status='ACTIVE';
-- No tenant-crossing release, regardless of a claimed SERVICE_ROLE.
set role service_role;
do $$ declare out jsonb;
begin
 out:=public.servicedesk_release_held_slot_atomic(jsonb_build_object(
 'workspaceId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'actorUserId','77777777-7777-4777-8777-777777777777',
 'quoteId','33333333-3333-4333-8333-333333333333',
 'holdId','88888888-8888-4888-8888-888888888888',
 'slotId','55555555-5555-4555-8555-555555555555',
 'expiresAt','2100-01-02T00:00:00Z'));
 if out->>'ok' is distinct from 'false' then
  raise exception 'F23_FOREIGN_WORKSPACE_RELEASED %',out; end if;
end $$;
reset role;
-- A changed saved expiration is a new capacity claim, not old owner intent.
update public.slot_holds set expires_at='2100-01-03T00:00:00Z';
set role service_role;
select public.sd_f23_expect_denied('expired_selection_changed','HOLD_NOT_ELIGIBLE');
reset role;
update public.slot_holds set expires_at='2100-01-02T00:00:00Z';
-- Every persisted payment application, including REVIEW, blocks release.
insert into public.verified_payment_applications values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '88888888-8888-4888-8888-888888888888','REVIEW');
set role service_role;
select public.sd_f23_expect_denied('payment_review_exists','PAYMENT_OR_BOOKING_RECORDED');
reset role;
delete from public.verified_payment_applications;
-- Every actual saved visit also blocks hold release.
insert into public.visits values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333');
set role service_role;
select public.sd_f23_expect_denied('visit_exists','PAYMENT_OR_BOOKING_RECORDED');
reset role;
delete from public.visits;
-- Ambiguous current quote cannot release saved capacity.
insert into public.quotes values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444','ACCEPTED',5);
set role service_role;
select public.sd_f23_expect_denied('two_active_quote_versions','AMBIGUOUS_QUOTE');
reset role;
delete from public.quotes where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
-- Branch drift must deny.
update public.crews set branch_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role service_role;
select public.sd_f23_expect_denied('foreign_crew_branch','CREW_NOT_ELIGIBLE');
reset role;
update public.crews set branch_id='22222222-2222-4222-8222-222222222222';
-- The valid path changes ONLY the expected HELD row, once.
set role service_role;
do $$ declare out jsonb;
begin
 out:=public.sd_f23_release_fixture();
 if out->>'ok' is distinct from 'true' or out->>'state' is distinct from 'HOLD_RELEASED'
    or out->>'holdId' is distinct from '88888888-8888-4888-8888-888888888888'
    or out->>'newCapacityVerified' is distinct from 'false'
    or out->>'paymentChanged' is distinct from 'false' then
   raise exception 'F23_POSITIVE_ATOMIC_RELEASE_MISMATCH %',out;end if;
end $$;
reset role;
do $$ begin
 if (select status from public.slot_holds
   where id='88888888-8888-4888-8888-888888888888') <> 'RELEASED'
 or (select count(*) from public.visits) <> 0
 or (select count(*) from public.verified_payment_applications) <> 0
 then raise exception 'F23_POSITIVE_RELEASE_LEFT_UNEXPECTED_SIDE_EFFECTS';end if;
end $$;
set role service_role;
do $$ declare out jsonb;begin
 out:=public.sd_f23_release_fixture();
 if out->>'ok' is distinct from 'false' then
  raise exception 'F23_DUPLICATE_RELEASE_ALLOWED %',out;end if;
end $$;
reset role;
select 'PG17_F23_ATOMIC_HOLD_RELEASE_ACL_DENIAL_CAS_AND_SINGLE_WRITE_PASS' as receipt;
