#!/usr/bin/env bash
# F26 owner-role revocation races: real PostgreSQL 17 on fictional localhost.
set -euo pipefail
test "${SERVICEDESK_F26_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f26_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing reviewed SHA}"
command -v psql >/dev/null
owner='11111111-1111-4111-8111-111111111111'
visit='ffffffff-ffff-4fff-8fff-ffffffffffff'
crew_member='22222222-2222-4222-8222-222222222222'
locker=''
tmp="$(mktemp -d)"
cleanup(){
 [[ -z "$locker" ]] || { kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; }
 rm -rf "$tmp"
}
trap cleanup EXIT
reset_case(){
 psql -X -v ON_ERROR_STOP=1 -q -c "
 update public.visits set status='SCHEDULED',version=1 where id='$visit';
 delete from public.outbox_events;
 update public.memberships set role='OWNER',status='ACTIVE' where user_id='$owner';
 update public.memberships set role='CREW',status='ACTIVE' where user_id='$crew_member';
 "
}
barrier(){
 local marker="$1" ready=0
 for _ in $(seq 1 45); do
  if grep -q "$marker" "$tmp/locker";then ready=1;break;fi
  if ! kill -0 "$locker" 2>/dev/null;then
    cat "$tmp/locker" >&2;echo "F26_OWNER_LOCKER_EXITED_EARLY" >&2;exit 1
  fi
  sleep 0.1
 done
 if [[ "$ready" != "1" ]];then
  echo "F26_OWNER_LOCKER_BARRIER_MISSING" >&2;cat "$tmp/locker" >&2;exit 1
 fi
}
expect_locked(){
 local query="$1"
 if PGOPTIONS="-c lock_timeout=800ms" psql -X -v VERBOSITY=verbose \
    -v ON_ERROR_STOP=1 -c "$query" > "$tmp/waiter" 2>&1; then
   echo "F26_OWNER_RACE_UNEXPECTED_WRITE_OR_ASSIGN_SUCCESS" >&2
   cat "$tmp/waiter" >&2;exit 1
 fi
 if ! grep -q '55P03' "$tmp/waiter";then
   echo "F26_OWNER_EXPECTED_ROW_LOCK_CONFLICT" >&2
   cat "$tmp/waiter" >&2;exit 1
 fi
}
status(){
 psql -X -At -v ON_ERROR_STOP=1 -c "
 select status::text||':'||version||':'||
  (select count(*) from public.outbox_events)
 from public.visits where id='$visit';"
}
# Race A: an OWNER's role revocation takes the membership lock FIRST.
# The competing ASSIGN must lock-wait instead of using the old EXISTS.
reset_case
{
 printf 'begin;\n'
 printf "update public.memberships set status='REVOKED' where user_id='%s';\n" "$owner"
 printf "select 'F26_OWNER_REVOCATION_FIRST_LOCK_HELD' as marker;\n"
 sleep 4
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F26_OWNER_REVOCATION_FIRST_LOCK_HELD'
expect_locked 'select public.sd_f26_rpc_assign();'
wait "$locker";locker=''
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c  "select public.sd_f26_rpc_assign()->>'code';")" != "FORBIDDEN" ]];then
 echo "F26_REVOKED_OWNER_ASSIGNED_AFTER_COMMIT" >&2;exit 1
fi
if [[ "$(status)" != "SCHEDULED:1:0" ]];then
 echo "F26_OWNER_REVOKE_FIRST_LEFT_PARTIAL_WRITE" >&2;exit 1
fi
echo 'PG17_F26_OWNER_REVOKE_FIRST_FOR_SHARE_RACE_PASS'

# Race B: ASSIGN gets the membership lock first, then an administrator
# attempts OWNER revocation. The admin must block until the visit
# transaction rolls back; neither transition nor outbox can survive.
reset_case
{
 printf 'begin;\n'
 printf 'select public.sd_f26_rpc_assign();\n'
 printf "select 'F26_OWNER_ASSIGN_FIRST_LOCK_HELD' as marker;\n"
 sleep 4
 printf 'rollback;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F26_OWNER_ASSIGN_FIRST_LOCK_HELD'
expect_locked "update public.memberships set status='REVOKED' where user_id='$owner';"
wait "$locker";locker=''
if [[ "$(status)" != "SCHEDULED:1:0" ]];then
 echo "F26_OWNER_ASSIGN_ROLLBACK_LEFT_PARTIAL_VISIT_OUTBOX" >&2;exit 1
fi
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c  "select status::text from public.memberships where user_id='$owner';")" != "ACTIVE" ]];then
 echo "F26_OWNER_ASSIGN_ROLLBACK_LOST_MEMBERSHIP" >&2;exit 1
fi
# Healthy OWNER and CREW source still produce a normal confirmed
# SCHEDULED -> ASSIGNED + one internal outbox after the race.
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c  "select public.sd_f26_rpc_assign()->>'ok';")" != "true" ]];then
 echo "F26_OWNER_RACE_REGRESSED_NORMAL_ASSIGN" >&2;exit 1
fi
if [[ "$(status)" != "ASSIGNED:2:1" ]];then
 echo "F26_OWNER_RACE_POSITIVE_VISIT_OUTBOX_MISMATCH" >&2;exit 1
fi
echo 'PG17_F26_OWNER_ASSIGN_FIRST_LOCK_ROLLBACK_AND_POSITIVE_PASS'
