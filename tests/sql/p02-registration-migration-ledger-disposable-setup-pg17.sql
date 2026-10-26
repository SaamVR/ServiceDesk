\set ON_ERROR_STOP on
-- For disposable CI database ONLY. Deliberately small stand-in ledger.
do $p21_disposable$
begin
  if current_database() <> 'servicedesk_p02_ledger_probe' then
    raise exception 'P02_LEDGER_DISPOSABLE_DATABASE_REQUIRED';
  end if;
end $p21_disposable$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null
);
insert into supabase_migrations.schema_migrations(version,name) values
('20261012105723','sd_0062_v4_branch_trigger_rowtype_guard'),
('20261025200147','sd_0065_v4_default_branch_membership_authority');
\i docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql
select 'P02_LEDGER_DISPOSABLE_BASELINE_PASS' as result;
