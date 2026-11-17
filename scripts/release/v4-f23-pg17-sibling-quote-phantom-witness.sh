#!/usr/bin/env bash
# F23 KNOWN-UNSAFE sibling quote phantom witness. This is a DBA RELEASE VETO,
# not an acceptance PASS, migration, or permission to enable either F23 flag.
# Real two-session PostgreSQL 17, fictional localhost only.
set -euo pipefail
test "${SERVICEDESK_F23_PG17_DISPOSABLE_ONLY:-}" = "1"
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "sd_f23_disposable"
test "${PGUSER:-}" = "postgres"
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing reviewed SHA}"
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
# Strengthen the fictional fixture with a realistic quote -> request FK:
# INSERT's parent KEY SHARE lock is compatible with candidate's FOR SHARE.
psql -X -q -v ON_ERROR_STOP=1 -c "
 alter table public.quotes add constraint sd_f23_quote_request_fk
 foreign key (request_id) references public.requests(id);
 delete from public.quotes where id='$sibling';
 update public.quotes set status='ACCEPTED',version=4 where id='$quote';
 update public.memberships set status='ACTIVE',role='OWNER';
 update public.crews set branch_id='22222222-2222-4222-8222-222222222222',active=true;
 update public.slot_holds set status='HELD',expires_at='2100-01-02T00:00:00Z' where id='$hold';
 delete from public.visits;
 delete from public.verified_payment_applications;
 "
# Session A validates current quote count == 1, releases hold inside its
# uncommitted function transaction, then holds all acquired row locks.
{
 printf 'begin;\nset role service_role;\n'
 printf 'select public.sd_f23_release_fixture();\n'
 printf "select 'F23_SIBLING_PHANTOM_RELEASE_UNCOMMITTED';\n"
 sleep 5
 printf 'commit;\n'
} | psql -X -v ON_ERROR_STOP=1 > "$tmp/locker" 2>&1 &
locker="$!"
ready=0
for _ in $(seq 1 50);do
 if grep -q 'F23_SIBLING_PHANTOM_RELEASE_UNCOMMITTED' "$tmp/locker";then ready=1;break;fi
 if ! kill -0 "$locker" 2>/dev/null;then
  echo 'F23_PHANTOM_WITNESS_LOCKER_EARLY_EXIT' >&2;cat "$tmp/locker" >&2;exit 1
 fi
 sleep 0.1
done
if [[ "$ready" != "1" ]];then
 echo 'F23_PHANTOM_WITNESS_NO_BARRIER' >&2;cat "$tmp/locker" >&2;exit 1
fi
# Session B is an independent writer with a DIFFERENT quote ID.
# With no per-request uniqueness/index/write-lock, the insert is allowed
# even while session A's released slot remains uncommitted.
if ! PGOPTIONS="-c lock_timeout=1500ms" psql -X -v ON_ERROR_STOP=1 -c "
 insert into public.quotes(id,workspace_id,request_id,status,version)
 values ('$sibling','$ws','$req','ACCEPTED',5);
 " > "$tmp/writer" 2>&1;then
 echo 'F23_PHANTOM_WITNESS_WRITER_BLOCKED_OR_REJECTED_REVIEW_FIXTURE' >&2
 cat "$tmp/writer" >&2;exit 1
fi
wait "$locker";locker=''
if ! grep -q '"state": "HOLD_RELEASED"' "$tmp/locker" && \
   ! grep -q 'HOLD_RELEASED' "$tmp/locker";then
 echo 'F23_PHANTOM_WITNESS_ORIGINAL_RELEASE_DID_NOT_SUCCEED' >&2
 cat "$tmp/locker" >&2;exit 1
fi
actual="$(psql -X -At -v ON_ERROR_STOP=1 -c "
 select h.status||':'||
  (select count(*) from public.quotes q
   where q.workspace_id='$ws' and q.request_id='$req' and q.status<>'SUPERSEDED')||':'||
  (select count(*) from public.verified_payment_applications)||':'||
  (select count(*) from public.visits)
 from public.slot_holds h where h.id='$hold';")"
if [[ "$actual" != 'RELEASED:2:0:0' ]];then
 echo "F23_PHANTOM_WITNESS_UNEXPECTED_POST_STATE=$actual" >&2;exit 1
fi
# Evidence of an unresolved invariant break. A green CI step here means
# the regression witness RAN, NOT that F23 is approved or safe.
echo 'F23_KNOWN_UNSAFE_SIBLING_QUOTE_PHANTOM_REPRODUCED_RELEASE_VETO'
