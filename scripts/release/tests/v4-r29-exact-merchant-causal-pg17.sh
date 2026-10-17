#!/usr/bin/env bash
# Independent CRITIC-01: real disposable PG17 anti-false-positive matrix.
set -euo pipefail
sql="scripts/release/v4-merchant-exact-quote-chain-readonly.sql"
q(){ psql -X -v ON_ERROR_STOP=1 -tA -f "$sql"; }
check(){ local result; result="$(q)"; echo "$result" | grep -Fq "\"linkedAcceptedQuoteInvoiceCount\": $1"; echo "$result" | grep -Fq "\"matchingImmutableQuoteSourceExecutionCount\": $2"; echo "$result" | grep -Fq "\"matchingSucceededAttentionChainCount\": $3"; echo "$result" | grep -Fq "\"workspaceCountWithAllLinkedRecords\": $4"; }
check 2 1 1 1
echo "PG17_SYNTHETIC_CAUSAL_BASELINE_PASS"
# Wrong immutable source quote: unrelated same-branch action MUST NOT count.
psql -X -v ON_ERROR_STOP=1 -c "update public.workflow_executions set execution_key='live:40000000-0000-4000-8000-000000000001:'||repeat('0',64) where id='50000000-0000-4000-8000-000000000001'" >/dev/null
check 2 0 0 0
echo "PG17_FORGED_SOURCE_HASH_DENIED"
# Restore exact independent source key for the next tests.
psql -X -v ON_ERROR_STOP=1 -c "update public.workflow_executions set execution_key='live:40000000-0000-4000-8000-000000000001:'||encode(extensions.digest(concat_ws('|','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','QUOTE_ACCEPTED','20000000-0000-4000-8000-000000000001','0',''),'sha256'),'hex') where id='50000000-0000-4000-8000-000000000001'" >/dev/null
# A successful execution without a successful action MUST NOT count.
psql -X -v ON_ERROR_STOP=1 -c "update public.workflow_action_executions set state='FAILED' where id='60000000-0000-4000-8000-000000000001'" >/dev/null
check 2 1 0 0
echo "PG17_FAILED_ACTION_DENIED"
psql -X -v ON_ERROR_STOP=1 -c "update public.workflow_action_executions set state='SUCCEEDED' where id='60000000-0000-4000-8000-000000000001'" >/dev/null
# Wrong attention resource must not borrow another event's success.
psql -X -v ON_ERROR_STOP=1 -c "update public.attention_items set resource_id='50000000-0000-4000-8000-000000000002' where id='70000000-0000-4000-8000-000000000001'" >/dev/null
check 2 1 0 0
echo "PG17_UNLINKED_ATTENTION_DENIED"
psql -X -v ON_ERROR_STOP=1 -c "update public.attention_items set resource_id='50000000-0000-4000-8000-000000000001' where id='70000000-0000-4000-8000-000000000001'" >/dev/null
# A paid-looking invoice whose amount doesn't match accepted quote no longer counts.
psql -X -v ON_ERROR_STOP=1 -c "update public.invoices set total_minor=19999 where id='30000000-0000-4000-8000-000000000001'" >/dev/null
check 1 0 0 0
echo "PG17_WRONG_INVOICE_AMOUNT_DENIED"
psql -X -v ON_ERROR_STOP=1 -c "update public.invoices set total_minor=20000 where id='30000000-0000-4000-8000-000000000001'" >/dev/null
# Superseded or non-accepted quotes can never be used as current acceptance.
psql -X -v ON_ERROR_STOP=1 -c "update public.quotes set superseded_by='29999999-9999-4999-8999-999999999999' where id='20000000-0000-4000-8000-000000000001'" >/dev/null
check 1 0 0 0
echo "PG17_SUPERSEDED_QUOTE_DENIED"
psql -X -v ON_ERROR_STOP=1 -c "update public.quotes set superseded_by=null,status='DRAFT' where id='20000000-0000-4000-8000-000000000001'" >/dev/null
check 1 0 0 0
echo "PG17_UNACCEPTED_QUOTE_DENIED"
