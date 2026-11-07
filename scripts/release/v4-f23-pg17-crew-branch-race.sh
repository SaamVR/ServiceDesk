#!/usr/bin/env bash
# F23 crew branch reassignment vs owner hold release; real disposable PG17.
# Only 127.0.0.1 sd_f23_disposable, never a connected business database.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing exact SHA}"
command -v psql >/dev/null
crew='66666666-6666-4666-8666-666666666666'
hold='88888888-8888-4888-8888-888888888888'
original='22222222-2222-4222-8222-222222222222'
foreign='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
locker=''
tmp="$(mktemp -d)"
cleanup(){
 [[ -z "$locker" ]] || { kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; }
 rm -rf "$tmp"
}
trap cleanup EXIT
reset_case(){
 psql -X -q -v ON_ERROR_STOP=1 -c "
 update public.quotes set status='ACCEPTED',version=4;
 update public.memberships set status='ACTIVE',role='OWNER';
 update public.crews set branch_id='$original',active=true where id='$crew';
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 delete from public.visits;
 delete from public.verified_payment_applications;
 "
}
barrier(){
 local marker="$1" ready=0
 for _ in $(seq 1 45);do
  if grep -q "$marker" "$tmp/locker";then ready=1;break;fi
  if ! kill -0 "$locker" 2>/dev/null;then
   echo "F23_CREW_LOCKER_EARLY_EXIT" >&2;cat "$tmp/locker" >&2;exit 1
  fi
  sleep 0.1
 done
 if [[ "$ready" != "1" ]];then
  echo "F23_CREW_LOCK_BARRIER_MISSING" >&2;cat "$tmp/locker" >&2;exit 1
 fi
}
expect_locked(){
 if PGOPTIONS="-c lock_timeout=800ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1   -c "$1" > "$tmp/waiter" 2>&1;then
  echo "F23_CREW_RACE_UNEXPECTED_NONBLOCKING_OPERATION" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
 if ! grep -q '55P03' "$tmp/waiter";then
  echo "F23_CREW_EXPECTED_PG_ROW_LOCK_TIMEOUT" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
}
state(){
 psql -X -At -v ON_ERROR_STOP=1 -c "
 select c.branch_id::text||':'||h.status||':'||
  (select count(*) from public.visits)||':'||
  (select count(*) from public.verified_payment_applications)
 from public.crews c cross join public.slot_holds h
 where c.id='$crew' and h.id='$hold';"
}
# Branch-change first. F23 must lock-wait on crew FOR SHARE and reject
# after a branch mismatch commits without releasing booked capacity.
reset_case
{
 printf 'begin;\n'
 printf "update public.crews set branch_id='%s' where id='%s';\n" "$foreign" "$crew"
 printf "select 'F23_CREW_CHANGE_FIRST_LOCK_HELD';\n"
 sleep 3
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_CREW_CHANGE_FIRST_LOCK_HELD'
expect_locked 'set role service_role; select public.sd_f23_release_fixture();'
wait "$locker";locker=''
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'code';" |
 grep -qx 'CREW_NOT_ELIGIBLE';then
 echo "F23_CREW_REASSIGN_FIRST_ALLOWED_RELEASE" >&2;exit 1
fi
if [[ "$(state)" != "$foreign:HELD:0:0" ]];then
 echo "F23_CREW_REASSIGN_FIRST_SIDE_EFFECT" >&2;exit 1
fi
echo 'PG17_F23_CREW_BRANCH_CHANGE_FIRST_FOR_SHARE_DENIED_PASS'

# Release first. The crew FOR SHARE row lock prevents a concurrent
# rebranch until the release transaction rolls back.
reset_case
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_RELEASE_FIRST_CREW_LOCK_HELD';\n"
 sleep 3
 printf 'rollback;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_RELEASE_FIRST_CREW_LOCK_HELD'
expect_locked "update public.crews set branch_id='$foreign' where id='$crew';"
wait "$locker";locker=''
if [[ "$(state)" != "$original:HELD:0:0" ]];then
 echo "F23_CREW_RELEASE_FIRST_ROLLBACK_LEFT_WRITE" >&2;exit 1
fi
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'state';" |
 grep -qx 'HOLD_RELEASED';then
 echo "F23_CREW_NORMAL_RELEASE_REGRESSION" >&2;exit 1
fi
if [[ "$(state)" != "$original:RELEASED:0:0" ]];then
 echo "F23_CREW_POSITIVE_RELEASE_MUTATED_VISIT_OR_PAYMENT" >&2;exit 1
fi
echo 'PG17_F23_RELEASE_FIRST_CREW_REBRANCH_ROLLBACK_PASS'
