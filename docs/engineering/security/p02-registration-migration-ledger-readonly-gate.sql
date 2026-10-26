\set ON_ERROR_STOP on
-- P21 SOURCE-ONLY, pre-install ledger reconciliation. Run using psql -X -f
-- with the existing live DB ONLY after a fresh independent read-only
-- registration preflight. Not an installation/repair/rollback script.
-- This pins the observed out-of-order 0065 repair, not a future desired
-- migration sequence. No Supabase or Auth records are written or selected.
begin transaction read only;
do $p02_migration_ledger$
declare
  v_0062 integer;
  v_0065 integer;
  v_absent integer;
  v_duplicates integer;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'P02_MIGRATION_LEDGER_BLOCKED: migration ledger missing';
  end if;
  select count(*) into v_0062
  from supabase_migrations.schema_migrations
  where version = '20261012105723'
    and name = 'sd_0062_v4_branch_trigger_rowtype_guard';
  select count(*) into v_0065
  from supabase_migrations.schema_migrations
  where version = '20261025200147'
    and name = 'sd_0065_v4_default_branch_membership_authority';
  select count(*) into v_absent
  from supabase_migrations.schema_migrations
  where name ~ '^sd_006[34](_|$)'
    or version in ('20261025200145','20261025200146');
  select count(*) into v_duplicates
  from supabase_migrations.schema_migrations
  where (name = 'sd_0065_v4_default_branch_membership_authority'
         and version <> '20261025200147')
     or (version = '20261025200147'
         and name <> 'sd_0065_v4_default_branch_membership_authority')
     or (name = 'sd_0062_v4_branch_trigger_rowtype_guard'
         and version <> '20261012105723')
     or (version = '20261012105723'
         and name <> 'sd_0062_v4_branch_trigger_rowtype_guard');
  if v_0062 <> 1 or v_0065 <> 1
     or v_absent <> 0 or v_duplicates <> 0 then
    raise exception 'P02_MIGRATION_LEDGER_BLOCKED: 0062/0065 preimage or unapplied 0063/0064 drift';
  end if;
end $p02_migration_ledger$;
select 'P02_MIGRATION_LEDGER_READONLY_PASS' as result;
rollback;
