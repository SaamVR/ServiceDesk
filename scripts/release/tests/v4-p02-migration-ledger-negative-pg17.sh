#!/usr/bin/env bash
# P21 ledger drift tests on a disposable PostgreSQL 17 fixture, never main.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "servicedesk_p02_ledger_probe" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPASSWORD:-}" != "disposable-p02-registration-only" ]]; then
  echo P02_LEDGER_DISPOSABLE_ONLY >&2
  exit 2
fi
attestation='docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql'
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
pg() { psql -X -v ON_ERROR_STOP=1 "$@"; }
assert_passed() {
  pg -f "$attestation" >"$log" 2>&1 || {
    echo P02_LEDGER_BASELINE_RESTORATION_FAILED >&2
    cat "$log" >&2
    exit 1
  }
  grep -q 'P02_MIGRATION_LEDGER_READONLY_PASS' "$log"
}
assert_blocked() {
  local tag="$1"
  if pg -f "$attestation" >"$log" 2>&1; then
    echo "P02_LEDGER_FALSE_GREEN_$tag" >&2
    exit 1
  fi
  grep -q 'P02_MIGRATION_LEDGER_BLOCKED' "$log" || {
    echo "P02_LEDGER_WRONG_FAILURE_$tag" >&2
    cat "$log" >&2
    exit 1
  }
  echo "P02_LEDGER_DENIED_$tag"
}
assert_passed
pg -c "delete from supabase_migrations.schema_migrations where version='20261025200147'"
assert_blocked MISSING_0065
pg -c "insert into supabase_migrations.schema_migrations values ('20261025200147','sd_0065_v4_default_branch_membership_authority')"

pg -c "update supabase_migrations.schema_migrations set name='sd_0065_unreviewed' where version='20261025200147'"
assert_blocked RENAMED_0065
pg -c "update supabase_migrations.schema_migrations set name='sd_0065_v4_default_branch_membership_authority' where version='20261025200147'"

pg -c "delete from supabase_migrations.schema_migrations where version='20261012105723'"
assert_blocked MISSING_0062
pg -c "insert into supabase_migrations.schema_migrations values ('20261012105723','sd_0062_v4_branch_trigger_rowtype_guard')"

pg -c "insert into supabase_migrations.schema_migrations values ('20261027100100','sd_0063_unreviewed')"
assert_blocked UNREVIEWED_0063
pg -c "delete from supabase_migrations.schema_migrations where version='20261027100100'"

pg -c "insert into supabase_migrations.schema_migrations values ('20261027100101','sd_0064_unreviewed')"
assert_blocked UNREVIEWED_0064
pg -c "delete from supabase_migrations.schema_migrations where version='20261027100101'"

# The ledger uses letter-suffixed versions elsewhere (e.g. sd_0012a), so
# 0063a/0064a must not slip past a too-specific _ suffix matcher.
pg -c "insert into supabase_migrations.schema_migrations values ('20261027100103','sd_0063a_unreviewed')"
assert_blocked UNREVIEWED_0063A
pg -c "delete from supabase_migrations.schema_migrations where version='20261027100103'"
pg -c "insert into supabase_migrations.schema_migrations values ('20261027100104','sd_0064a_unreviewed')"
assert_blocked UNREVIEWED_0064A
pg -c "delete from supabase_migrations.schema_migrations where version='20261027100104'"

pg -c "insert into supabase_migrations.schema_migrations values ('20261027100102','sd_0065_v4_default_branch_membership_authority')"
assert_blocked DUPLICATE_0065_NAME
pg -c "delete from supabase_migrations.schema_migrations where version='20261027100102'"

pg -c "update supabase_migrations.schema_migrations set name='sd_0062_wrong' where version='20261012105723'"
assert_blocked RENAMED_0062
pg -c "update supabase_migrations.schema_migrations set name='sd_0062_v4_branch_trigger_rowtype_guard' where version='20261012105723'"
assert_passed
echo P02_LEDGER_NEGATIVE_MATRIX_PASS
