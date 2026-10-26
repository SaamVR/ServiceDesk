#!/usr/bin/env bash
# P02 source-only transaction ordering proof. Synthetic PG17 service ONLY.
# Never run against a shared or real Supabase database.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "servicedesk_p02_registration_test" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPASSWORD:-}" != "disposable-p02-registration-only" ]]; then
  echo "P02_CONCURRENCY_FIXTURE_ONLY" >&2
  exit 2
fi
actor='99999999-9999-4999-8999-999999999999'
logfile="$(mktemp)"
closelog="$(mktemp)"
revokelog="$(mktemp)"
owner_pid=''
cleanup() {
  if [[ -n "$owner_pid" ]] && kill -0 "$owner_pid" 2>/dev/null; then
    kill "$owner_pid" 2>/dev/null || true
    wait "$owner_pid" 2>/dev/null || true
  fi
  rm -f "$logfile" "$closelog" "$revokelog"
}
trap cleanup EXIT

psql -X -v ON_ERROR_STOP=1 <<'SQL'
update servicedesk_security.owner_registration_control set mode='QA_ONLY' where singleton;
insert into auth.users(id,email_confirmed_at,is_anonymous)
values('99999999-9999-4999-8999-999999999999',pg_catalog.clock_timestamp(),false);
insert into servicedesk_security.owner_registration_grants(user_id,expires_at)
values('99999999-9999-4999-8999-999999999999',pg_catalog.clock_timestamp()+interval '1 hour');
SQL

# One database session makes a genuine authorized registration then keeps the
# transaction open. Both operator mutations MUST be blocked by the function's
# own FOR SHARE locks, not by the function never reaching the registration path.
psql -X -A -t -v ON_ERROR_STOP=1 > "$logfile" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select case when
 (public.servicedesk_register_owner_workspace(
 'Synthetic Concurrency','qa-lock-proof','UTC','USD')->>'ok')='true'
 then 'P02_REGISTRATION_TX_OPEN' else 'P02_UNEXPECTED_DENIAL' end;
select pg_catalog.pg_sleep(7);
rollback;
SQL
owner_pid=$!
ready=0
for i in {1..80}; do
  if grep -q '^P02_REGISTRATION_TX_OPEN$' "$logfile"; then
    ready=1
    break
  fi
  if ! kill -0 "$owner_pid" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "$ready" != "1" ]]; then
  echo "Owner transaction never reached approved registration" >&2
  cat "$logfile" >&2
  exit 1
fi

# The mode row must not be able to switch to CLOSED while the already admitted
# transaction is still open. A lock timeout is expected and is not a waiver.
if psql -X -v ON_ERROR_STOP=1 -c "set lock_timeout='450ms'; update servicedesk_security.owner_registration_control set mode='CLOSED' where singleton;" > "$closelog" 2>&1; then
  echo "P02_CONTROL_KILL_SWITCH_WRITE_RACED_IN_FLIGHT_REGISTRATION" >&2
  exit 1
fi
grep -q 'canceling statement due to lock timeout' "$closelog"

# The exact approved actor's grant must similarly be protected from concurrent
# revocation until this transaction commits or rolls back.
if psql -X -v ON_ERROR_STOP=1 -c "set lock_timeout='450ms'; update servicedesk_security.owner_registration_grants set revoked_at=pg_catalog.clock_timestamp() where user_id='99999999-9999-4999-8999-999999999999';" > "$revokelog" 2>&1; then
  echo "P02_QA_GRANT_REVOCATION_RACED_IN_FLIGHT_REGISTRATION" >&2
  exit 1
fi
grep -q 'canceling statement due to lock timeout' "$revokelog"

wait "$owner_pid"
owner_pid=''
# All transaction-scoped registration writes must have been rolled back.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $p02_concurrency_cleanup$
begin
 if exists (select 1 from public.workspaces where slug='qa-lock-proof')
    or exists (select 1 from public.audit_events where action='WORKSPACE_REGISTERED'
       and actor_user_id='99999999-9999-4999-8999-999999999999')
    or (select mode from servicedesk_security.owner_registration_control where singleton) <> 'QA_ONLY'
    or exists (select 1 from servicedesk_security.owner_registration_grants
       where user_id='99999999-9999-4999-8999-999999999999' and revoked_at is not null)
 then raise exception 'P02_CONCURRENT_CONTROL_OR_GRANT_MUTATED_OR_REGISTRATION_PERSISTED';
 end if;
end $p02_concurrency_cleanup$;
update servicedesk_security.owner_registration_control set mode='CLOSED' where singleton;
delete from servicedesk_security.owner_registration_grants
 where user_id='99999999-9999-4999-8999-999999999999';
delete from auth.users where id='99999999-9999-4999-8999-999999999999';
SQL
echo P02_REGISTRATION_CONCURRENCY_LOCKS_PASS
