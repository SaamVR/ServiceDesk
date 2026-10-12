#!/usr/bin/env bash
# Concurrency-only verification against the disposable PostgreSQL 17 CI service.
# NEVER run this script against an actual customer/staging/production database.
set -euo pipefail
if [[ "${SERVICEDESK_PG17_DISPOSABLE_ONLY:-}" != "1" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGDATABASE:-}" != "servicedesk_migration_test" ||
      "${PGUSER:-}" != "postgres" ]]; then
  echo "PG17_QUOTE_LEASE_CONCURRENCY_DISPOSABLE_TARGET_REQUIRED" >&2
  exit 2
fi

q="55555555-5555-4555-8555-555555555555"
workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
psql -X -v ON_ERROR_STOP=1 -q <<SQL
INSERT INTO public.quotes(id,workspace_id,status) VALUES ('$q','$workspace','SENT');
UPDATE public.quotes SET status='ACCEPTED' WHERE id='$q';
SQL

# Hold the exact event row in a separate transaction. A competing worker
# must SKIP this locked row, not block and not double-claim the event.
psql -X -v ON_ERROR_STOP=1 -q > /tmp/sd-v4-holder.out 2>&1 <<SQL &
BEGIN;
SELECT id FROM public.workflow_source_events WHERE quote_id='$q' FOR UPDATE;
SELECT pg_sleep(6);
COMMIT;
SQL
holder_pid=$!

# Wait until the locking connection enters pg_sleep (it has already taken
# FOR UPDATE) rather than depending on arbitrary runner timing.
locked=0
for _ in $(seq 1 35); do
  active=$(psql -X -At -v ON_ERROR_STOP=1 -c "
    SELECT count(*) FROM pg_stat_activity
    WHERE datname=current_database() AND state='active'
      AND query LIKE '%SELECT pg_sleep(6)%'
      AND pid<>pg_backend_pid();" | tail -1)
  if [[ "$active" =~ ^[1-9][0-9]*$ ]]; then locked=1; break; fi
  sleep 0.2
done
if [[ "$locked" != 1 ]]; then
  wait "$holder_pid" || true
  echo "PG17_QUOTE_SOURCE_LOCK_NOT_PROVEN" >&2
  exit 1
fi

attempt=$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE service_role;
SELECT count(*) FROM public.servicedesk_claim_quote_source_events('worker_SKIP_01',1);
SQL
)
if [[ "$(echo "$attempt" | tail -1)" != "0" ]]; then
  echo "PG17_QUOTE_SOURCE_SKIP_LOCKED_FAILED" >&2
  exit 1
fi

wait "$holder_pid"
claim=$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE service_role;
SELECT count(*) FROM public.servicedesk_claim_quote_source_events('worker_AFTER_01',1);
SQL
)
if [[ "$(echo "$claim" | tail -1)" != "1" ]]; then
  echo "PG17_QUOTE_SOURCE_AFTER_LOCK_RELEASE_FAILED" >&2
  exit 1
fi

double=$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE service_role;
SELECT count(*) FROM public.servicedesk_claim_quote_source_events('worker_DOUBLE_01',1);
SQL
)
if [[ "$(echo "$double" | tail -1)" != "0" ]]; then
  echo "PG17_QUOTE_SOURCE_DUPLICATE_CLAIM_FAILED" >&2
  exit 1
fi

state=$(psql -X -At -v ON_ERROR_STOP=1 -c "
  SELECT state||':'||attempts||':'||locked_by
  FROM public.workflow_source_events WHERE quote_id='$q';")
if [[ "$state" != "PROCESSING:1:worker_AFTER_01" ]]; then
  echo "PG17_QUOTE_SOURCE_LEASE_RECEIPT_FAILED" >&2
  exit 1
fi

echo "PG17_QUOTE_SOURCE_REAL_CONCURRENT_CLAIM_PASS"
