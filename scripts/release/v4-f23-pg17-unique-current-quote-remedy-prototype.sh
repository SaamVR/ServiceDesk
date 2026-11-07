#!/usr/bin/env bash
# F23 REVIEW-ONLY proposed partial UNIQUE index, on fictional PG17 only.
# NOT a production migration, not approved, not a payment/provider guarantee.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing exact SHA}"
command -v psql >/dev/null
ws='11111111-1111-4111-8111-111111111111'
req='44444444-4444-4444-8444-444444444444'
quote='33333333-3333-4333-8333-333333333333'
sibling='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
hold='88888888-8888-4888-8888-888888888888'
locker=''
tmp="$(mktemp -d)"
cleanup(){
 [[ -z "$locker" ]] || { kill "$locker" 2>/dev/null || true; wait "$locker" 2>/dev/null || true; }
 rm -rf "$tmp"
}
trap cleanup EXIT
# The preceding witness intentionally left TWO active quotes.
# Normalize only the disposable fixture to allow a unique index proposal.
psql -X -q -v ON_ERROR_STOP=1 -c "
 delete from public.quotes where id='$sibling';
 update public.quotes set status='ACCEPTED',version=4 where id='$quote';
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 create unique index sd_f23_review_only_one_current_quote
 on public.quotes(workspace_id,request_id)
 where status <> 'SUPERSEDED';
 "
# With a database constraint, a second active quote is forbidden even
# from a writer that ignores every application-side advisory lock.
if PGOPTIONS="-c lock_timeout=1200ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c "
 insert into public.quotes(id,workspace_id,request_id,status,version)
 values('$sibling','$ws','$req','ACCEPTED',5);
 " > "$tmp/duplicate" 2>&1;then
 echo 'F23_PROTOTYPE_DUPLICATE_ACTIVE_QUOTE_UNEXPECTEDLY_ACCEPTED' >&2
 cat "$tmp/duplicate" >&2;exit 1
fi
if ! grep -q '23505' "$tmp/duplicate";then
 echo 'F23_PROTOTYPE_EXPECTED_UNIQUE_VIOLATION_MISSING' >&2
 cat "$tmp/duplicate" >&2;exit 1
fi
echo 'PG17_F23_REVIEW_ONLY_PARTIAL_UNIQUE_INDEX_BLOCKS_DUPLICATE_CURRENT_QUOTE'

# Interleaving: session A has completed a successful release in an
# uncommitted transaction; session B tries to insert a sibling.
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_UNIQUE_PROTOTYPE_RELEASE_UNCOMMITTED';\n"
 sleep 4
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
ready=0
for _ in $(seq 1 45);do
 if grep -q 'F23_UNIQUE_PROTOTYPE_RELEASE_UNCOMMITTED' "$tmp/locker";then ready=1;break;fi
 if ! kill -0 "$locker" 2>/dev/null;then
  echo 'F23_UNIQUE_PROTOTYPE_LOCKER_FAILED' >&2;cat "$tmp/locker" >&2;exit 1
 fi
 sleep 0.1
done
if [[ "$ready" != "1" ]];then
 echo 'F23_UNIQUE_PROTOTYPE_NO_SESSION_BARRIER' >&2;exit 1
fi
if PGOPTIONS="-c lock_timeout=1200ms" psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -c "
 insert into public.quotes(id,workspace_id,request_id,status,version)
 values('$sibling','$ws','$req','ACCEPTED',5);
 " > "$tmp/concurrent" 2>&1;then
 echo 'F23_UNIQUE_PROTOTYPE_CONCURRENT_DUPLICATE_ALLOWED' >&2;exit 1
fi
if ! grep -q '23505' "$tmp/concurrent";then
 echo 'F23_UNIQUE_PROTOTYPE_CONCURRENT_DUPLICATE_NOT_REJECTED_AS_UNIQUE' >&2
 cat "$tmp/concurrent" >&2;exit 1
fi
wait "$locker";locker=''
state="$(psql -X -At -v ON_ERROR_STOP=1 -c "
 select h.status||':'||
   (select count(*) from public.quotes q where
   q.workspace_id='$ws' and q.request_id='$req' and q.status<>'SUPERSEDED')
 from public.slot_holds h where h.id='$hold';")"
if [[ "$state" != "RELEASED:1" ]];then
 echo "F23_UNIQUE_PROTOTYPE_BAD_CONCURRENT_STATE=$state" >&2;exit 1
fi
echo 'PG17_F23_REVIEW_ONLY_UNIQUE_INDEX_PREVENTS_CONCURRENT_SIBLING_PHANTOM'

# Intended replacement order is transactional SUPERSEDE then INSERT.
# Existing quote creation flows must be audited before approving this rule.
psql -X -q -v ON_ERROR_STOP=1 -c "
 begin;
 update public.quotes set status='SUPERSEDED',version=version+1 where id='$quote';
 insert into public.quotes(id,workspace_id,request_id,status,version)
 values('$sibling','$ws','$req','ACCEPTED',6);
 commit;
 "
after="$(psql -X -At -v ON_ERROR_STOP=1 -c "
 select (select count(*) from public.quotes where workspace_id='$ws' and
 request_id='$req' and status <> 'SUPERSEDED')||':'||
 (select status from public.quotes where id='$quote')||':'||
 (select status from public.quotes where id='$sibling');")"
if [[ "$after" != '1:SUPERSEDED:ACCEPTED' ]];then
 echo "F23_UNIQUE_PROTOTYPE_REPLACEMENT_COMPATIBILITY_MISMATCH=$after" >&2;exit 1
fi
echo 'PG17_F23_REVIEW_ONLY_SUPERSEDE_THEN_INSERT_COMPATIBILITY_PASS'
