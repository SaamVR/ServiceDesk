\set ON_ERROR_STOP on
-- ONLY in servicedesk_p02_postinstall_negative, never main Supabase.
do $p02_target$
begin
 if current_database() <> 'servicedesk_p02_postinstall_negative'
 then raise exception 'P02_POSTINSTALL_DISPOSABLE_DB_REQUIRED'; end if;
end $p02_target$;
\i tests/sql/p02-registration-preflight-negative-setup-pg17.sql
\i docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql
\i docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql
select md5(p.prosrc) as p02_guarded_registration_body_md5
from pg_proc p
where p.oid=to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)');
select 'P02_POSTINSTALL_DISPOSABLE_BASELINE_PASS' as result;
