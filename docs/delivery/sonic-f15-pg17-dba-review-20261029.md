# SONIC F15 — PostgreSQL 17 atomic-ingress candidate / independent DBA review

**2026-10-29 · SOURCE-ONLY / UNAPPLIED · PR #884.** No live Supabase function, table, schema, role, trigger, worker, schedule or deployment was created.

## Candidate and proof

- Candidate SQL: `docs/engineering/security/f15-unanswered-lead-atomic-db-candidate.sql`, deliberately **outside** `supabase/migrations/`.
- Disposable schema: `tests/sql/v4-f15-atomic-pg17-fixture.sql`; tests: `tests/sql/v4-f15-atomic-pg17-acceptance.sql` and `scripts/release/v4-f15-atomic-pg17-concurrency.sh`.
- GitHub Actions: `.github/workflows/v4-f15-atomic-pg17-rc.yml` starts a fresh `postgres:17` service with fictional users and `sd_f15_disposable` only, checks exact HEAD SHA and requires `PGHOST=127.0.0.1`; no Supabase network or secrets.
- Verified first proof at commit `3b4915e108847fdb6b38fd434127fc558ab77a91`: [PG17 action](https://github.com/SaamVR/ServiceDesk/actions/runs/40885479498) SUCCESS. It established two-tenant permissions, rollback of an inserted event, forced constraint rollback, an identical-timestamp distinct inbound event, saved-reply suppression, forged scope/key/version denial, 12 real concurrent claims (1 INSERTED, 11 ALREADY_RECORDED), and a true cross-session message-write block.
- Hardening follow-up: remove authenticated EXECUTE on internal advisory lock, reject fractional client version/threshold, fail-closed on customer threads in other branches, and compare saved replay version. Requires **fresh exact-head PG17 verification**, not credit from the earlier action.

## Real schema alignment

- Canonical `0001_core.sql`: requests(id,workspace_id,version,status,created_at,customer_id), conversations(id,workspace_id,request_id,customer_id), messages(id,workspace_id,conversation_id,direction,sender_kind,created_at).
- Canonical `0053_v2_multibranch_core.sql`: adds and requires requests.branch_id and conversations.branch_id, workspace_branches(workspace_id,id,active).
- Canonical `0008_conversation_inbox_runtime.sql`: preserves saved message direction, sender kind and created_at, with additional metadata. The candidate does not read message bodies, attachments, provider receipts or customer contact fields.
- Canonical `0063` journal is **QUOTE_ACCEPTED ONLY**, not re-used to store F15 events. Current production may still lack migration `0063` and `0064`; do not assume installed.

## Independent human DBA/security preflight — owner approval required

1. Verify exact target project, canonical HEAD, migration ledger and deployed schema/function preimage in READ-ONLY mode. Confirm `public.digest(bytea,text)` is installed **in public** (the candidate currently requires pgcrypto there); if pgcrypto is only under `extensions`, the candidate must be adapted and re-reviewed. Do not create extensions in live without permission.
2. Confirm all inbound, outbound, historical imports, deletes, conversation relinks, message corrections and maintenance paths fire the advisory-lock triggers. A writer bypassing these triggers invalidates completeness and the source-lock receipt. Determine lock order/deadlock impact under realistic load; reject if the DB's message pathways can bypass lock.
3. Inspect all active RLS/ACL, service role, default schema grants, foreign keys, current request statuses, branch constraints, and migration ordering. Internal F15 ledger must expose no `anon`/`authenticated` table or RPC permissions. Verify helper function direct EXECUTE denied to clients, while reviewed SECURITY DEFINER triggers still function.
4. Ensure the source truly has a single request-linked conversation and **all customer conversation history** is in scope. Current candidate conservatively denies ambiguous multi-conversation/same-customer data; it is not a universal unread Inbox monitor. A nullable customer / visitor-session mapping needs separate review.
5. Check timestamp and saved-message identity agreement with Next.js `trustedQuoteInstant` and Node `JSON.stringify` SHA-256 source key. Use an independent cross-language hash oracle, not only the SQL generator and function implementing the same hash logic.
6. Require a preimage export/backup and reviewed rollback plan, with tenant-wide negative tests and transaction audit receipts. Failure or deadlock must fail closed. The SQL function's `transactionCommitted: true` asserts an **HTTP RPC-autocommitted response** only; a psql explicit transaction may still roll back and cannot be counted as a durable production success.
7. Obtain separately explicit owner authorization for **live schema installation**, then independently authorized second real OWNER A/B identities and signed-in browser/JWT/RLS UAT, worker/scheduler activation and Vercel deployment. P02 #818 remains the release veto.

## Rollback and safety

The candidate creates one ledger table, three internal functions, and two triggers; it grants service-only ledger read/insert and RPC execute. **Do not automatically drop anything in production.** Before any authorized rollback, disable and drain future F15 worker only after source producer coordination, capture exact ledger/audit preimage, verify no other code depends on the triggers, approve drop sequence with DBA and owner, and preserve backup artifacts. Re-running the disposable CI fixture tests no production rollback.

**Next development:** finalize independent Critic, cross-language hash proof, and disposable PG17 hardening. After that, source is review-ready—not install-authorized or operational.
