#!/usr/bin/env bash
# F23 selected quote supersession vs owner hold release; actual isolated PG17.
# This tests a targeted existing quote's FOR UPDATE lock, NOT sibling quote phantoms.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing exact source SHA}"
command -v psql >/dev/null
quote='33333333-3333-4333-8333-333333333333'
hold='88888888-8888-4888-8888-888888888888'
locker=''
tmp="$(mktemp -d)"
cleanup(){
 [[ -z "$locker" ]] || { kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; }
 rm -rf "$tmp"
}
trap cleanup EXIT
reset_case(){
 psql -X -q -v ON_ERROR_STOP=1 -c "
 update public.quotes set status='ACCEPTED',version=4 where id='$quote';
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 update public.memberships set status='ACTIVE',role='OWNER';
 update public.crews set branch_id='22222222-2222-4222-8222-222222222222',active=true;
 delete from public.visits;
 delete from public.verified_payment_applications;
 "
}
barrier(){
 local marker="$1" ready=0
 for _ in $(seq 1 45);do
  if grep -q "$marker" "$tmp/locker";then ready=1;break;fi
  if ! kill -0 "$locker" 2>/dev/null;then
    echo "F23_QUOTE_LOCKER_EARLY_EXIT" >&2;cat "$tmp/locker" >&2;exit 1
  fi
  sleep 0.1
 done
 if [[ "$ready" != "1" ]];then
  echo "F23_QUOTE_LOCK_BARRIER_MISSING" >&2;cat "$tmp/locker" >&2;exit 1
 fi
}
expect_locked(){
 if PGOPTIONS="-c lock_timeout=800ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1    -c "$1" > "$tmp/waiter" 2>&1;then
  echo "F23_QUOTE_RACE_NONBLOCKING_OPERATION" >&2;cat "$tmp/waiter" >&2;exit 1
 fi
 if ! grep -q '55P03' "$tmp/waiter";then
  echo "F23_QUOTE_RACE_EXPECTED_PG_LOCK_TIMEOUT" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
}
state(){
 psql -X -At -v ON_ERROR_STOP=1 -c "
 select q.status||':'||h.status||':'||
 (select count(*) from public.verified_payment_applications)||':'||
 (select count(*) from public.visits)
 from public.quotes q cross join public.slot_holds h
 where q.id='$quote' and h.id='$hold';"
}
# Quote-transition first: a writer supersedes an ACCEPTED quote, then
# holds the real quote row lock. F23 must wait, then refuse to release.
reset_case
{
 printf 'begin;\n'
 printf "update public.quotes set status='SUPERSEDED',version=version+1 where id='%s';\n" "$quote"
 printf "select 'F23_SUPERSEDE_FIRST_QUOTE_LOCKED';\n"
 sleep 3
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_SUPERSEDE_FIRST_QUOTE_LOCKED'
expect_locked 'set role service_role; select public.sd_f23_release_fixture();'
wait "$locker";locker=''
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'code';" |
 grep -qx 'QUOTE_NOT_ELIGIBLE';then
 echo "F23_SUPERSEDED_QUOTE_RELEASED" >&2;exit 1
fi
if [[ "$(state)" != "SUPERSEDED:HELD:0:0" ]];then
 echo "F23_SUPERSEDE_FIRST_LEFT_PARTIAL_WRITE" >&2;exit 1
fi
echo 'PG17_F23_QUOTE_SUPERSEDE_FIRST_LOCK_DENIAL_PASS'

# Release first: transaction has the original quote row lock. Writer
# cannot supersede it before release rolls back; both changes disappear.
reset_case
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_RELEASE_FIRST_QUOTE_LOCKED';\n"
 sleep 3
 printf 'rollback;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_RELEASE_FIRST_QUOTE_LOCKED'
expect_locked "update public.quotes set status='SUPERSEDED',version=version+1 where id='$quote';"
wait "$locker";locker=''
if [[ "$(state)" != "ACCEPTED:HELD:0:0" ]];then
 echo "F23_QUOTE_RELEASE_ROLLBACK_LEFT_PARTIAL_WRITE" >&2;exit 1
fi
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'state';" |
 grep -qx 'HOLD_RELEASED';then
 echo "F23_QUOTE_RELEASE_NORMAL_CASE_REGRESSION" >&2;exit 1
fi
if [[ "$(state)" != "ACCEPTED:RELEASED:0:0" ]];then
 echo "F23_QUOTE_RELEASE_POSITIVE_SIDE_EFFECT" >&2;exit 1
fi
echo 'PG17_F23_RELEASE_FIRST_QUOTE_SUPERSESSION_ROLLBACK_PASS'
