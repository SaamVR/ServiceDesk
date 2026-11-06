#!/usr/bin/env bash
# Real two-connection PG17 F23 hold release vs historical quote->hold deposit order.
# FICTIONAL localhost sd_f23_disposable only, NOT Supabase or customer payments.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing exact reviewed SHA}"
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
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 update public.memberships set status='ACTIVE',role='OWNER';
 delete from public.verified_payment_applications;
 delete from public.visits;
 "
}
barrier(){
 local marker="$1" ready=0
 for _ in $(seq 1 50); do
  if grep -q "$marker" "$tmp/locker";then ready=1;break;fi
  if ! kill -0 "$locker" 2>/dev/null;then
    cat "$tmp/locker" >&2;echo "F23_LOCKER_EXITED_EARLY" >&2;exit 1
  fi
  sleep 0.1
 done
 if [[ "$ready" != "1" ]];then
  echo "F23_LOCK_BARRIER_MISSING" >&2;cat "$tmp/locker" >&2;exit 1
 fi
}
expect_row_lock(){
 if PGOPTIONS="-c lock_timeout=800ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1   -c "$1" >"$tmp/waiter" 2>&1;then
  echo "F23_RACE_UNEXPECTED_WRITE_OR_RELEASE_SUCCEEDED" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
 if ! grep -q '55P03' "$tmp/waiter";then
  echo "F23_MISSING_REAL_QUOTE_ROW_LOCK_TIMEOUT" >&2
  cat "$tmp/waiter" >&2;exit 1
 fi
}
state(){
 psql -X -At -v ON_ERROR_STOP=1 -c "
 select status||':'||
  (select count(*) from public.visits)||':'||
  (select count(*) from public.verified_payment_applications)
 from public.slot_holds where id='$hold';"
}
# Deposit-first: historical payment application locks quote -> hold.
# The F23 atomic RPC must wait at the QUOTE and reject confirmed hold after COMMIT.
reset_case
{
 printf 'begin;\n'
 printf "select id from public.quotes where id='%s' for update;\n" "$quote"
 printf "select id from public.slot_holds where id='%s' for update;\n" "$hold"
 printf "select 'F23_DEPOSIT_FIRST_QUOTE_HOLD_LOCKED';\n"
 sleep 3
 printf "update public.slot_holds set status='CONFIRMED' where id='%s';\n" "$hold"
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_DEPOSIT_FIRST_QUOTE_HOLD_LOCKED'
expect_row_lock 'set role service_role; select public.sd_f23_release_fixture();'
wait "$locker";locker=''
if ! psql -X -At -v ON_ERROR_STOP=1 -c "set role service_role; select public.sd_f23_release_fixture()->>'code';" | grep -qx 'HOLD_NOT_ELIGIBLE';then
 echo "F23_RELEASE_AFTER_DEPOSIT_CONFIRMATION_ALLOWED" >&2;exit 1
fi
if [[ "$(state)" != "CONFIRMED:0:0" ]];then
 echo "F23_DEPOSIT_FIRST_LEFT_UNEXPECTED_SIDE_EFFECT" >&2;exit 1
fi
echo "PG17_F23_DEPOSIT_FIRST_QUOTE_HOLD_SERIALIZATION_PASS"

# Release-first: actual RPC takes quote lock before hold, and a simulated
# deposit acquiring that quote must block until F23 transaction rolls back.
reset_case
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_RELEASE_FIRST_QUOTE_HOLD_LOCKED';\n"
 sleep 3
 printf 'rollback;\n'
} | psql -X -v ON_ERROR_STOP=1 >"$tmp/locker" 2>&1 &
locker="$!"
barrier 'F23_RELEASE_FIRST_QUOTE_HOLD_LOCKED'
expect_row_lock "select id from public.quotes where id='$quote' for update;"
wait "$locker";locker=''
if [[ "$(state)" != "HELD:0:0" ]];then
 echo "F23_ROLLED_BACK_RELEASE_LEFT_WRITES" >&2;exit 1
fi
if ! psql -X -At -v ON_ERROR_STOP=1 -c "set role service_role; select public.sd_f23_release_fixture()->>'state';" | grep -qx 'HOLD_RELEASED';then
 echo "F23_NORMAL_RELEASE_FAILED_AFTER_ROLLBACK" >&2;exit 1
fi
if [[ "$(state)" != "RELEASED:0:0" ]];then
 echo "F23_POSITIVE_RELEASE_MUTATED_PAYMENT_VISIT" >&2;exit 1
fi
echo "PG17_F23_RELEASE_FIRST_ROLLBACK_AND_POSITIVE_PASS"
