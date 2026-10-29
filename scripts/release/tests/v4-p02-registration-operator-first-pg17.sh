#!/usr/bin/env bash
# P02 approved-operator-first concurrency proof in DISPOSABLE PG17 ONLY.
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "servicedesk_p02_registration_test" ||
      "$PGUSER" != "postgres" ||
      "$PGPASSWORD" != "disposable-p02-registration-only" ]]; then
  echo 'P02_CONCURRENCY_FIXTURE_ONLY' >&2
  exit 2
fi

oplog="$(mktemp)"
checklog="$(mktemp)"
operator_pid=''
cleanup() {
  if [[ -n "$operator_pid" ]] && kill -0 "$operator_pid" 2>/dev/null; then
    kill "$operator_pid" 2>/dev/null || true
    wait "$operator_pid" 2>/dev/null || true
  fi
  rm -f "$oplog" "$checklog"
}
trap cleanup EXIT

# Source fixture installed the candidate in the disposable PG17 DB.
# A new synthetic subject avoids the existing owner-idempotence fast path.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
update servicedesk_security.owner_registration_control
  set mode='QA_ONLY' where singleton;
insert into auth.users(id,email_confirmed_at,is_anonymous)
values ('88888888-8888-4888-8888-888888888888',pg_catalog.clock_timestamp(),false);
insert into servicedesk_security.owner_registration_grants(user_id,expires_at)
values ('88888888-8888-4888-8888-888888888888',
  pg_catalog.clock_timestamp() + interval '1 hour');
SQL

# Confirm the RPC works for an approved owner before testing denials.
psql -XAt -v ON_ERROR_STOP=1 > "$checklog" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='88888888-8888-4888-8888-888888888888';
select case when (public.servicedesk_register_owner_workspace(
  'Synthetic Reverse Race','qa-reverse-race','UTC','USD')->>'ok')='true'
  then 'P02_APPROVED_PRECONDITION_PASS' else 'P02_FALSE_DENIAL' end;
rollback;
SQL
grep -qx 'P02_APPROVED_PRECONDITION_PASS' "$checklog"
echo 'P02_APPROVED_PRECONDITION_PASS'

wait_for_operator() {
  local marker="$1"
  local found=0
  for i in {1..60}; do
    if grep -q "^$marker$" "$oplog"; then found=1; break; fi
    if ! kill -0 "$operator_pid" 2>/dev/null; then break; fi
    sleep 0.1
  done
  if [[ "$found" != "1" ]]; then
    echo "Operator transaction did not acquire its change: $marker" >&2
    cat "$oplog" >&2
    exit 1
  fi
}
assert_denied() {
  local receipt="$1"
  psql -XAt -v ON_ERROR_STOP=1 > "$checklog" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='88888888-8888-4888-8888-888888888888';
select public.servicedesk_register_owner_workspace(
  'Synthetic Reverse Race','qa-reverse-race','UTC','USD')->>'code';
rollback;
SQL
  grep -qx 'REGISTRATION_NOT_AUTHORIZED' "$checklog" || {
    echo "$receipt: unexpected registration outcome" >&2
    cat "$checklog" >&2
    exit 1
  }
  echo "$receipt"
}

# CLOSED acquires UPDATE lock before new registration. Registration must wait
# and re-evaluate the updated row, not see the previously approved mode.
psql -XAt -v ON_ERROR_STOP=1 > "$oplog" 2>&1 <<'SQL' &
begin;
update servicedesk_security.owner_registration_control
  set mode='CLOSED' where singleton;
select 'P02_MODE_UPDATE_LOCKED';
select pg_catalog.pg_sleep(2);
commit;
SQL
operator_pid=$!
wait_for_operator 'P02_MODE_UPDATE_LOCKED'
assert_denied 'P02_OPERATOR_CLOSED_WINS_PASS'
wait "$operator_pid"
operator_pid=''

psql -X -v ON_ERROR_STOP=1 <<'SQL'
update servicedesk_security.owner_registration_control
  set mode='QA_ONLY' where singleton;
SQL

# Repeat with exact user's grant row changed first. The waiting registration
# must see the revoked row after operator COMMIT under READ COMMITTED.
: > "$oplog"
psql -XAt -v ON_ERROR_STOP=1 > "$oplog" 2>&1 <<'SQL' &
begin;
update servicedesk_security.owner_registration_grants
  set revoked_at=pg_catalog.clock_timestamp()
  where user_id='88888888-8888-4888-8888-888888888888';
select 'P02_GRANT_REVOKE_LOCKED';
select pg_catalog.pg_sleep(2);
commit;
SQL
operator_pid=$!
wait_for_operator 'P02_GRANT_REVOKE_LOCKED'
assert_denied 'P02_OPERATOR_REVOCATION_WINS_PASS'
wait "$operator_pid"
operator_pid=''

# Inspect real tables: a misbehaving RPC that inserted then returned deny
# must not produce a false green.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $p02_reverse_cleanup$
begin
  if exists (select 1 from public.workspaces where slug='qa-reverse-race')
    or exists (select 1 from public.audit_events
      where actor_user_id='88888888-8888-4888-8888-888888888888')
    or (select mode from servicedesk_security.owner_registration_control where singleton) <> 'QA_ONLY'
    or not exists (select 1 from servicedesk_security.owner_registration_grants
      where user_id='88888888-8888-4888-8888-888888888888'
        and revoked_at is not null)
  then raise exception 'P02_OPERATOR_WIN_RETAINED_UNAUTHORIZED_WORKSPACE_OR_LOST_REVOCATION'; end if;
end $p02_reverse_cleanup$;
update servicedesk_security.owner_registration_control set mode='CLOSED' where singleton;
delete from servicedesk_security.owner_registration_grants
 where user_id='88888888-8888-4888-8888-888888888888';
delete from auth.users where id='88888888-8888-4888-8888-888888888888';
SQL
echo 'P02_OPERATOR_FIRST_CONCURRENCY_PASS'
