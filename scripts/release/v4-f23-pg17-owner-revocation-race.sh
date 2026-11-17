#!/usr/bin/env bash
# F23 OWNER membership revocation interleavings against REAL candidate PG17 SQL.
# Strictly isolated FICTIONAL localhost database; no connected Supabase writes.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing exact reviewed source SHA}"
command -v psql >/dev/null
owner='77777777-7777-4777-8777-777777777777'
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
 update public.memberships set role='OWNER',status='ACTIVE' where user_id='$owner';
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 delete from public.verified_payment_applications;
 delete from public.visits;
 "
}
barrier(){
 local marker="$1" ready=0
 for _ in $(seq 1 45);do
  if grep -q "$marker" "$tmp/locker";then ready=1;break;fi
  if ! kill -0 "$locker" 2>/dev/null;then
   echo "F23_OWNER_LOCKER_EXITED_EARLY" >&2
   cat "$tmp/locker" >&2;exit 1
  fi
  sleep 0.1
 done
 if [[ "$ready" != "1" ]];then
  echo "F23_OWNER_LOCK_BARRIER_MISSING" >&2;cat "$tmp/locker" >&2;exit 1
 fi
}
expect_locked(){
 local cmd="$1"
 if PGOPTIONS="-c lock_timeout=750ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1    -c "$cmd" >"$tmp/waiter" 2>&1;then
  echo "F23_OWNER_RACE_UNEXPECTED_NONBLOCKING_OPERATION" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
 if ! grep -q '55P03' "$tmp/waiter";then
  echo "F23_OWNER_RACE_EXPECTED_PG_LOCK_TIMEOUT" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
}
saved(){
 psql -X -At -v ON_ERROR_STOP=1 -c "
 select h.status||':'||m.status||':'||
 (select count(*) from public.visits)||':'||
 (select count(*) from public.verified_payment_applications)
 from public.slot_holds h cross join public.memberships m
 where h.id='$hold' and m.user_id='$owner';"
}
# Revocation-first: administrative role revocation holds the row before
# the release RPC checks active OWNER via FOR SHARE. It must lock-wait and
# reject after revocation commits, with no slot/payment/booking side effects.
reset_case
{
 printf 'begin;\n'
 printf "update public.memberships set status='REVOKED' where user_id='%s';\n" "$owner"
 printf "select 'F23_OWNER_REVOKE_FIRST_ROW_LOCKED';\n"
 sleep 3
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_OWNER_REVOKE_FIRST_ROW_LOCKED'
expect_locked 'set role service_role; select public.sd_f23_release_fixture();'
wait "$locker";locker=''
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'code';" |
 grep -qx 'FORBIDDEN';then
 echo "F23_REVOKED_OWNER_UNSAFE_RELEASE" >&2;exit 1
fi
if [[ "$(saved)" != "HELD:REVOKED:0:0" ]];then
 echo "F23_OWNER_REVOKE_FIRST_LEFT_PARTIAL_WRITE" >&2;exit 1
fi
echo 'PG17_F23_OWNER_REVOKE_FIRST_FOR_SHARE_DENIED_NO_WRITE_PASS'

# Release-first: in the live transaction F23 has taken a FOR SHARE
# membership lock and changed HELD -> RELEASED but NOT committed.
# A competing revocation must wait. Rolling back release restores both.
reset_case
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_OWNER_RELEASE_FIRST_ROW_LOCKED';\n"
 sleep 3
 printf 'rollback;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_OWNER_RELEASE_FIRST_ROW_LOCKED'
expect_locked "update public.memberships set status='REVOKED' where user_id='$owner';"
wait "$locker";locker=''
if [[ "$(saved)" != "HELD:ACTIVE:0:0" ]];then
 echo "F23_OWNER_RELEASE_FIRST_ROLLBACK_LEFT_WRITE" >&2;exit 1
fi
if ! psql -X -At -v ON_ERROR_STOP=1 -c  "set role service_role; select public.sd_f23_release_fixture()->>'state';" |
 grep -qx 'HOLD_RELEASED';then
 echo "F23_OWNER_RACE_NORMAL_RELEASE_REGRESSION" >&2;exit 1
fi
if [[ "$(saved)" != "RELEASED:ACTIVE:0:0" ]];then
 echo "F23_OWNER_RELEASE_FIRST_POSITIVE_RELEASE_MISMATCH" >&2;exit 1
fi
echo 'PG17_F23_OWNER_RELEASE_FIRST_LOCK_ROLLBACK_AND_POSITIVE_PASS'
