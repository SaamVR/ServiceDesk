#!/usr/bin/env bash
# PostgreSQL17 disposable proof ONLY. No Supabase credentials or network.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "servicedesk_p02_postinstall_negative" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPASSWORD:-}" != "disposable-p02-registration-only" ]]; then
  echo P02_POSTINSTALL_DISPOSABLE_ONLY >&2
  exit 2
fi
attestation='docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql'
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
pg() { psql -X -v ON_ERROR_STOP=1 "$@"; }
assert_blocked() {
  local label="$1"
  if pg -f "$attestation" > "$log" 2>&1; then
    echo "P02_POSTINSTALL_FALSE_GREEN_$label" >&2
    exit 1
  fi
  grep -q 'P02_REGISTRATION_POSTINSTALL_BLOCKED' "$log" || {
    echo "P02_POSTINSTALL_WRONG_FAILURE_$label" >&2
    cat "$log" >&2
    exit 1
  }
  if grep -q 'P02_REGISTRATION_POSTINSTALL_CLOSED_PASS' "$log"; then
    echo "P02_POSTINSTALL_FALSE_PASS_$label" >&2
    exit 1
  fi
  echo "P02_POSTINSTALL_DENIED_$label"
}
assert_passed() {
  pg -f "$attestation" > "$log" 2>&1 || {
    echo P02_POSTINSTALL_RESTORED_BASELINE_FAILED >&2
    cat "$log" >&2
    exit 1
  }
  grep -q 'P02_REGISTRATION_POSTINSTALL_CLOSED_PASS' "$log"
}
assert_passed

# Any switch from CLOSED invalidates the before-provisioning receipt.
pg -c "update servicedesk_security.owner_registration_control set mode='QA_ONLY' where singleton"
assert_blocked MODE_OPEN
pg -c "update servicedesk_security.owner_registration_control set mode='CLOSED' where singleton"

pg -c "insert into servicedesk_security.owner_registration_grants(user_id,expires_at) values ('aaaaaaaa-0000-4000-8000-000000000001',pg_catalog.clock_timestamp() + interval '1 hour')"
assert_blocked GRANT_PRESENT
pg -c "delete from servicedesk_security.owner_registration_grants where user_id='aaaaaaaa-0000-4000-8000-000000000001'"

pg -c "grant execute on function public.servicedesk_register_owner_workspace(text,text,text,text) to anon"
assert_blocked ANON_RPC
pg -c "revoke execute on function public.servicedesk_register_owner_workspace(text,text,text,text) from anon"
pg -c "grant execute on function public.servicedesk_register_owner_workspace(text,text,text,text) to public"
assert_blocked PUBLIC_RPC
pg -c "revoke execute on function public.servicedesk_register_owner_workspace(text,text,text,text) from public"
pg -c "grant usage on schema servicedesk_security to authenticated"
assert_blocked PRIVATE_SCHEMA
pg -c "revoke usage on schema servicedesk_security from authenticated"

# Even permissions irrelevant to the normal request path must invalidate
# the install receipt. A prior SELECT-only check missed these grants.
pg -c "grant delete on table servicedesk_security.owner_registration_control to authenticated"
assert_blocked TABLE_DELETE
pg -c "revoke delete on table servicedesk_security.owner_registration_control from authenticated"
pg -c "grant maintain on table servicedesk_security.owner_registration_grants to anon"
assert_blocked TABLE_MAINTAIN
pg -c "revoke maintain on table servicedesk_security.owner_registration_grants from anon"
pg -c "grant select (mode) on table servicedesk_security.owner_registration_control to anon"
assert_blocked COLUMN_SELECT
pg -c "revoke select (mode) on table servicedesk_security.owner_registration_control from anon"

# Tampering with DDL constraints must be detected even if the current
# control row is still CLOSED and there are no QA grants.
pg -c "alter table servicedesk_security.owner_registration_control drop constraint owner_registration_control_mode_check"
assert_blocked MODE_CHECK_DROPPED
pg -c "alter table servicedesk_security.owner_registration_control add constraint owner_registration_control_mode_check check (mode in ('CLOSED','QA_ONLY','PUBLIC'))"

pg -c "alter table servicedesk_security.owner_registration_grants disable row level security"
assert_blocked RLS_OFF
pg -c "alter table servicedesk_security.owner_registration_grants enable row level security"
pg -c "alter function public.servicedesk_register_owner_workspace(text,text,text,text) security invoker"
assert_blocked INVOKER
pg -c "alter function public.servicedesk_register_owner_workspace(text,text,text,text) security definer"

# Even an otherwise harmless unreviewed function comment must invalidate
# the exact post-install source receipt. This checks the body digest, not only
# the presence of key authorization words or the SECURITY DEFINER flag.
pg <<'SQL'
do $p18_tamper$
declare old_ddl text; modified_ddl text;
begin
  select pg_get_functiondef(p.oid) into old_ddl
  from pg_proc p where p.oid=to_regprocedure(
    'public.servicedesk_register_owner_workspace(text,text,text,text)');
  modified_ddl := replace(old_ddl,
    '-- Do not trust user_metadata, caller IDs, client-owned roles or actor IDs.',
    '-- P18_UNREVIEWED_COMMENT_BODY_DRIFT'||chr(10)||
    '  -- Do not trust user_metadata, caller IDs, client-owned roles or actor IDs.');
  if modified_ddl=old_ddl then raise exception 'P02_UNREVIEWED_TEST_TAMPER_MISSING'; end if;
  execute modified_ddl;
end $p18_tamper$;
SQL
assert_blocked BODY_HASH
pg <<'SQL'
do $p18_restore$
declare old_ddl text; restored_ddl text;
begin
  select pg_get_functiondef(p.oid) into old_ddl
  from pg_proc p where p.oid=to_regprocedure(
    'public.servicedesk_register_owner_workspace(text,text,text,text)');
  restored_ddl := replace(old_ddl,
    '  -- P18_UNREVIEWED_COMMENT_BODY_DRIFT'||chr(10),'');
  if restored_ddl=old_ddl then raise exception 'P02_UNREVIEWED_TEST_RESTORE_MISSING'; end if;
  execute restored_ddl;
end $p18_restore$;
SQL

# Check negative cases did not leave test database falsely damaged.
assert_passed
echo P02_POSTINSTALL_NEGATIVE_MATRIX_PASS
