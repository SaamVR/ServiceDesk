\set ON_ERROR_STOP on
-- P22 SINGLE-DATABASE RELEASE-LIFECYCLE REHEARSAL. SYNTHETIC FIXTURE ONLY.
-- NEVER execute against a real Supabase project, staging, or customer DB.
do $p22_db_guard$
begin
  if current_database() <> 'servicedesk_p02_registration_rollback' then
    raise exception 'P02_P22_DISPOSABLE_DB_REQUIRED';
  end if;
end $p22_db_guard$;

-- The known out-of-order 0065 ledger is a precondition, not a command to
-- replay 0063/0064. Its row count and versions must be preserved by install
-- and fail-closed rollback, even on the same database.
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(
  version text primary key,
  name text not null
);
insert into supabase_migrations.schema_migrations(version,name) values
 ('20261012105723', 'sd_0062_v4_branch_trigger_rowtype_guard'),
 ('20261025200147', 'sd_0065_v4_default_branch_membership_authority');

\i docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql

-- Source preflight and ledger receipt can both be evaluated before any
-- candidate installation. The existing fixture ran preflight already.
select 'P02_P22_BEFORE_INSTALL_LEDGER_PASS' as result;
