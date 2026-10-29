#!/usr/bin/env bash
# REAL PG17 concurrency only in a disposable GitHub Actions postgres:17 DB.
set -euo pipefail
if [[ "$SERVICEDESK_F15_PG17_DISPOSABLE_ONLY" != "1" ||
      "$PGHOST" != "127.0.0.1" ||
      "$PGDATABASE" != "sd_f15_disposable" ||
      "$PGUSER" != "postgres" ]]; then
  echo "F15_DISPOSABLE_PG17_TARGET_REQUIRED" >&2
  exit 2
fi
request="15151515-1515-4515-8515-151515151515"
conversation="16161616-1616-4616-8616-161616161616"
inbound="17171717-1717-4717-8717-171717171717"
workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
branch="11111111-1111-4111-8111-111111111111"
psql -X -v ON_ERROR_STOP=1 -q <<SQL
insert into public.requests values
 ('$request','$workspace','$branch',
  '18181818-1818-4818-8818-181818181818','NEW',1,
  clock_timestamp()-interval '3 hours');
insert into public.conversations values
 ('$conversation','$workspace','$branch','$request',
  '18181818-1818-4818-8818-181818181818');
insert into public.messages values
 ('$inbound','$workspace','$conversation','INBOUND','CUSTOMER',
  clock_timestamp()-interval '2 hours');
SQL
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for i in $(seq 1 12); do
  (
   psql -X -At -v ON_ERROR_STOP=1 -c \
    "set role service_role;
     select public.servicedesk_claim_f15_unanswered_lead_sla_review(
      public.f15_fixture_claim_input('$request')) ->> 'state';" > "$tmp/claim-$i"
  ) &
done
wait
inserted=$(grep -l -x 'INSERTED' "$tmp"/claim-* | wc -l)
reused=$(grep -l -x 'ALREADY_RECORDED' "$tmp"/claim-* | wc -l)
rows=$(psql -X -At -v ON_ERROR_STOP=1 -c \
 "select count(*) from public.f15_unanswered_lead_reviews
  where request_id='$request';")
if [[ "$inserted" != "1" || "$reused" != "11" || "$rows" != "1" ]]; then
  echo "F15_PG17_CONCURRENT_CLAIM_DUPLICATED inserted=$inserted reused=$reused rows=$rows" >&2
  exit 1
fi
# The request-scoped lock blocks a new inbound message COMMIT until a
# competing source claim releases its PostgreSQL transaction lock.
psql -X -v ON_ERROR_STOP=1 -q > "$tmp/holder" 2>&1 <<SQL &
begin;
select public.servicedesk_f15_lock_request('$workspace','$request');
select pg_sleep(5);
commit;
SQL
holder_pid=$!
held=0
for _ in $(seq 1 45); do
 active=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_stat_activity
   where datname=current_database() and state='active'
    and query like '%select pg_sleep(5)%'
    and pid <> pg_backend_pid();" | tail -1)
 if [[ "$active" =~ ^[1-9][0-9]*$ ]]; then held=1;break;fi
 sleep 0.1
done
if [[ "$held" != "1" ]]; then
  wait "$holder_pid" || true
  echo "F15_PG17_SOURCE_LOCK_NOT_ACQUIRED" >&2;exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q > "$tmp/writer" 2>&1 <<SQL &
insert into public.messages values
 ('abababab-abab-4bab-8bab-abababababab','$workspace','$conversation',
  'INBOUND','CUSTOMER',clock_timestamp()-interval '1 hour');
SQL
writer_pid=$!
blocked=0
for _ in $(seq 1 45); do
 waiting=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_stat_activity
   where datname=current_database()
     and pid<>pg_backend_pid() and wait_event_type='Lock'
     and query like '%abababab-abab-4bab-8bab-abababababab%';" | tail -1)
 if [[ "$waiting" =~ ^[1-9][0-9]*$ ]];then blocked=1;break;fi
 sleep 0.1
done
wait "$holder_pid"
wait "$writer_pid"
if [[ "$blocked" != "1" ]]; then
 echo "F15_PG17_MESSAGE_WRITE_DID_NOT_WAIT_FOR_REQUEST_LOCK" >&2;exit 1
fi
latest=$(psql -X -At -v ON_ERROR_STOP=1 -c \
 "select id from public.messages where conversation_id='$conversation'
  order by created_at desc,id desc limit 1;")
if [[ "$latest" != "abababab-abab-4bab-8bab-abababababab" ]]; then
  echo "F15_PG17_CONCURRENT_NEW_INBOUND_NOT_SAVED" >&2;exit 1
fi
state=$(psql -X -At -v ON_ERROR_STOP=1 -c \
 "set role service_role;
  select public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('$request')) ->> 'state';" | tail -1)
total=$(psql -X -At -v ON_ERROR_STOP=1 -c \
 "select count(*) from public.f15_unanswered_lead_reviews
  where request_id='$request';")
if [[ "$state" != "INSERTED" || "$total" != "2" ]]; then
 echo "F15_PG17_NEW_MESSAGE_EVENT_NOT_DISTINCT" >&2;exit 1
fi
echo "PG17_F15_12_SESSION_DEDUP_AND_WRITER_LOCK_PASS"
