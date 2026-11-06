#!/usr/bin/env bash
set -euo pipefail
# FICTIONAL PostgreSQL 17 disposable-only witness. NEVER run on real projects.
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f26_disposable"
test "${SERVICEDESK_F26_PG17_DISPOSABLE_ONLY:-}" = "1"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?exact source SHA missing}"
command -v psql >/dev/null
visit="ffffffff-ffff-4fff-8fff-ffffffffffff"
member="22222222-2222-4222-8222-222222222222"
lock_log="$(mktemp)"
race_log="$(mktemp)"
post_log="$(mktemp)"
locker=""
cleanup() {
 if [ -n "$locker" ]; then kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; fi
 rm -f "$lock_log" "$race_log" "$post_log"
}
trap cleanup EXIT
# Revert the positive receipt in disposable fixture; no real data exists here.
psql -X -v ON_ERROR_STOP=1 -q -c "
 update public.visits set status='SCHEDULED', version=1 where id='$visit';
 delete from public.outbox_events;
 update public.memberships set status='ACTIVE' where user_id='$member';"
# Session A holds the exact membership row lock while revoking crew access.
# The original ASSIGN RPC in session B must WAIT on the trigger's FOR SHARE,
# not read a stale ACTIVE snapshot and commit an assigned visit.
{
 printf "begin;\n"
 printf "update public.memberships set status='REVOKED' where user_id='%s';\n" "$member"
 printf "select 'F26_REVOCATION_ROW_LOCK_HELD' as marker;\n"
 sleep 4
 printf "commit;\n"
} | psql -X -v ON_ERROR_STOP=1 > "$lock_log" 2>&1 &
locker="$!"
ready=0
for _ in $(seq 1 40); do
 if grep -q F26_REVOCATION_ROW_LOCK_HELD "$lock_log"; then ready=1; break; fi
 if ! kill -0 "$locker" 2>/dev/null; then cat "$lock_log"; exit 1; fi
 sleep 0.1
done
if [ "$ready" != 1 ]; then
 echo "F26 concurrency barrier was not observed"; cat "$lock_log"; exit 1
fi
if PGOPTIONS="-c lock_timeout=800ms" \
 psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c \
 "select public.sd_f26_rpc_assign();" > "$race_log" 2>&1; then
 echo "F26 ASSIGN succeeded while membership revocation lock was held"; cat "$race_log"; exit 1
fi
if ! grep -q "55P03" "$race_log"; then
 echo "F26 expected row-lock serialization, saw a different failure"; cat "$race_log"; exit 1
fi
wait "$locker"
locker=""
if ! grep -q "COMMIT" "$lock_log"; then cat "$lock_log"; exit 1; fi
# After revocation commits, ASSIGN must fail via 23514 and NO OUTBOX.
if psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c \
 "select public.sd_f26_rpc_assign();" > "$post_log" 2>&1; then
 echo "F26 ASSIGN succeeded despite committed crew revocation"; cat "$post_log"; exit 1
fi
if ! grep -q "23514" "$post_log"; then
 echo "F26 expected restrictive row-guard SQLSTATE 23514"; cat "$post_log"; exit 1
fi
state="$(psql -X -At -v ON_ERROR_STOP=1 -c \
 "select status::text||':'||version||':'||(select count(*) from public.outbox_events)
 from public.visits where id='$visit';")"
if [ "$state" != "SCHEDULED:1:0" ]; then
 echo "F26 forbidden assignment mutated visit or outbox: $state";exit 1
fi
echo "PG17_F26_REAL_REVOCATION_RACE_DENIED_AND_NO_OUTBOX"
