\set ON_ERROR_STOP on
-- P02 DISPOSABLE ROLLBACK REHEARSAL ONLY.
-- This fixture deliberately restores the unguarded 0059 function and must
-- NEVER run against any existing main or shared Supabase database.
do $p02_rollback_target$
begin
  if current_database() is distinct from 'servicedesk_p02_registration_rollback'
  then raise exception 'P02_ROLLBACK_DISPOSABLE_DB_REQUIRED'; end if;
end $p02_rollback_target$;

-- Baseline installed by preflight-negative-setup-pg17.sql, before candidate.
create temporary table p02_function_preimage on commit preserve rows as
select
  pg_get_functiondef('public.servicedesk_register_owner_workspace(text,text,text,text)'::regprocedure) AS original_ddl,
  md5(pg_get_functiondef('public.servicedesk_register_owner_workspace(text,text,text,text)'::regprocedure)) AS original_md5;
do $p02_original$
begin
  if (select original_md5 from p02_function_preimage) <> 'e4de11c0b1b6736e46e201ee491d908f'
  then raise exception 'P02_ROLLBACK_PREIMAGE_MISMATCH'; end if;
end $p02_original$;

-- Install only on this disposable PostgreSQL database.
\i docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql
do $p02_installed$
begin
 if to_regnamespace('servicedesk_security') is null
    or (select mode from servicedesk_security.owner_registration_control where singleton)
       is distinct from 'CLOSED'
 then raise exception 'P02_ROLLBACK_INSTALL_NOT_CLOSED'; end if;
end $p02_installed$;

-- P22: the very SAME disposable database must produce the strict
-- read-only CLOSED/zero-grant installation receipt BEFORE rollback.
-- This attestation wraps its read in a transaction and rolls it back.
\i docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql

-- Critical rollback order: revoke RPC execution BEFORE restoring the
-- unguarded 0059 definition. CREATE OR REPLACE FUNCTION retains prior grants
-- and owner; the new private schema cannot be a permanent substitute for
-- revoking this publicly addressable function.
begin;
revoke all on function public.servicedesk_register_owner_workspace(text,text,text,text)
  from public, anon, authenticated;

do $p02_restore_registration$
declare
  v_original_ddl text;
begin
  select original_ddl into strict v_original_ddl from p02_function_preimage;
  execute v_original_ddl;
end $p02_restore_registration$;

-- In this rehearsal, discard only the synthetic security controls.
drop schema servicedesk_security cascade;

do $p02_verify_rollback$
begin
 if to_regnamespace('servicedesk_security') is not null
   or md5(pg_get_functiondef(
        'public.servicedesk_register_owner_workspace(text,text,text,text)'::regprocedure))
      is distinct from (select original_md5 from p02_function_preimage)
   or has_function_privilege(
        'anon','public.servicedesk_register_owner_workspace(text,text,text,text)','EXECUTE')
   or has_function_privilege(
        'authenticated','public.servicedesk_register_owner_workspace(text,text,text,text)','EXECUTE')
 then raise exception 'P02_ROLLBACK_GUARD_OR_RPC_PRIVILEGE_LEFT_OPEN'; end if;
end $p02_verify_rollback$;
commit;

-- Runtime privilege regression, not only pg_proc/ACL metadata.
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $p02_rollback_authenticated$
declare
  registration_result jsonb;
begin
  begin
    registration_result := public.servicedesk_register_owner_workspace(
      'Should Not Register','p02-after-rollback','UTC','USD');
    raise exception 'P02_ROLLBACK_ALLOWED_UNAPPROVED_AUTHENTICATED_REGISTRATION';
  exception when insufficient_privilege then
    null;
  end;
end $p02_rollback_authenticated$;
rollback;

do $p02_no_workspace$
begin
 if exists (select 1 from public.workspaces where slug='p02-after-rollback')
 then raise exception 'P02_ROLLBACK_CREATED_UNAUTHORIZED_WORKSPACE'; end if;
end $p02_no_workspace$;
-- The synthetic ledger is deliberately retained; installation/rollback
-- must not silently change 0062/0065 history while reverting the guard.
select 'P02_P22_ROLLBACK_RPCRIGHTS_CLOSED_PASS' AS result;
select 'P02_FAIL_CLOSED_REGISTRATION_ROLLBACK_PASS' AS result;
