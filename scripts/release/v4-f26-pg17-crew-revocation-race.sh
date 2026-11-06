#!/usr/bin/env bash
set -euo pipefail
# PostgreSQL 17: FICTIONAL DISPOSABLE-only row-lock witnesses; no user database.
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f26_disposable"
test "${SERVICEDESK_F26_PG17_DISPOSABLE_ONLY:-}" = "1"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?exact source SHA missing}"
command -v psql >/dev/null
visit="ffffffff-ffff-4fff-8fff-ffffffffffff"
crew="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
slot="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
member="22222222-2222-4222-8222-222222222222"
crew_member="99999999-9999-4999-8999-999999999999"
request="cccccccc-cccc-4ccc-8ccc-cccccccccccc"
correct_branch="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
foreign="bbbbbbbb-bbbb-4bbb-8bbb-111111111111"
lock_log="$(mktemp)"
race_log="$(mktemp)"
post_log="$(mktemp)"
locker=""
cleanup() {
 if [ -n "$locker" ]; then kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; fi
 rm -f "$lock_log" "$race_log" "$post_log"
}
trap cleanup EXIT
reset_disposable() {
 psql -X -q -v ON_ERROR_STOP=1 -c "
   update public.visits set status='SCHEDULED',version=1 where id='$visit';
   delete from public.outbox_events;
   update public.memberships set status='ACTIVE',role='CREW' where user_id='$member';
   update public.crews set active=true,branch_id='$correct_branch' where id='$crew';
   update public.crew_members set active=true where id='$crew_member';
   update public.requests set branch_id='$correct_branch' where id='$request';
   update public.capacity_slots set crew_id='$crew',branch_id='$correct_branch' where id='$slot';
 "
}
# Every source update changes a row the trigger protects with FOR SHARE.
# A competing ASSIGN must TIMEOUT (SQLSTATE 55P03), then fail (23514)
# after revocation commits, with no visit/outbox mutation.
run_locked_revocation() {
 local label="$1" update_sql="$2" marker="$3"
 reset_disposable
 : > "$lock_log"; : > "$race_log"; : > "$post_log"
 {
  printf "begin;\n"
  printf "%s;\n" "$update_sql"
  printf "select '%s' as marker;\n" "$marker"
  sleep 4
  printf "commit;\n"
 } | psql -X -v ON_ERROR_STOP=1 > "$lock_log" 2>&1 &
 locker="$!"
 local ready=0
 for _ in $(seq 1 45); do
  if grep -q "$marker" "$lock_log"; then ready=1; break; fi
  if ! kill -0 "$locker" 2>/dev/null; then
   echo "F26 $label locker exited early"; cat "$lock_log"; exit 1
  fi
  sleep 0.1
 done
 if [ "$ready" != "1" ]; then
  echo "F26 $label did not observe lock marker"; cat "$lock_log"; exit 1
 fi
 if PGOPTIONS="-c lock_timeout=800ms" \
  psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c \
  "select public.sd_f26_rpc_assign();" > "$race_log" 2>&1; then
  echo "F26 $label ASSIGN succeeded while revocation row lock held"
  cat "$race_log"; exit 1
 fi
 if ! grep -q "55P03" "$race_log"; then
  echo "F26 $label expected real PostgreSQL lock timeout 55P03"
  cat "$race_log"; exit 1
 fi
 wait "$locker"
 locker=""
 if ! grep -q 'COMMIT' "$lock_log"; then
  echo "F26 $label locker did not commit"; cat "$lock_log"; exit 1
 fi
 if psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c \
  "select public.sd_f26_rpc_assign();" > "$post_log" 2>&1; then
  echo "F26 $label ASSIGN succeeded after committed revocation"
  cat "$post_log"; exit 1
 fi
 if ! grep -q "23514" "$post_log"; then
  echo "F26 $label expected database guard check violation 23514"
  cat "$post_log"; exit 1
 fi
 local state
 state="$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select status::text||':'||version||':'||(select count(*) from public.outbox_events)
   from public.visits where id='$visit';")"
 if [ "$state" != "SCHEDULED:1:0" ]; then
  echo "F26 $label changed visit/outbox despite denial: $state"; exit 1
 fi
 echo "PG17_F26_$label REAL_LOCK_AND_REVOCATION_DENIED_NO_OUTBOX"
}
run_locked_revocation "MEMBERSHIP_REVOKED" \
 "update public.memberships set status='REVOKED' where user_id='$member'" \
 "F26_MEMBERSHIP_STATUS_ROW_LOCK_HELD"
run_locked_revocation "MEMBERSHIP_ROLE_CHANGED" \
 "update public.memberships set role='DISPATCHER' where user_id='$member'" \
 "F26_MEMBERSHIP_ROLE_ROW_LOCK_HELD"
run_locked_revocation "CREW_DEACTIVATED" \
 "update public.crews set active=false where id='$crew'" \
 "F26_CREW_ACTIVE_ROW_LOCK_HELD"
run_locked_revocation "CREW_MEMBER_REVOKED" \
 "update public.crew_members set active=false where id='$crew_member'" \
 "F26_CREW_MEMBER_ROW_LOCK_HELD"
run_locked_revocation "REQUEST_MOVED_BRANCH" \
 "update public.requests set branch_id='$foreign' where id='$request'" \
 "F26_REQUEST_BRANCH_ROW_LOCK_HELD"
run_locked_revocation "SLOT_MOVED_BRANCH" \
 "update public.capacity_slots set branch_id='$foreign' where id='$slot'" \
 "F26_SLOT_BRANCH_ROW_LOCK_HELD"
echo "PG17_F26_REAL_REVOCATION_RACE_DENIED_AND_NO_OUTBOX"
