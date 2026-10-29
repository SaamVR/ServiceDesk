# SONIC F15 — Unanswered-lead SLA & atomic internal ingress contract

**Date:** 2026-10-29
**Status:** SOURCE-ONLY DRAFT. Not installed, wired to a scheduler, merged, deployed or verified with a live tenant.

## Implemented in this batch

1. **Saved-evidence SLA evaluator** in src/server/workflows/sonic-f15-unanswered-lead-sla.ts: takes strictly allowlisted request and message-history facts. Requires an actual request/workspace/branch UUID, saved integer source version, complete response-history attestation, coherent ISO instants and bounded 15–1440 minute threshold. OPEN/NEW requests become an UNPERSISTED_SLA_CANDIDATE only if the last inbound is overdue and not answered afterward. Malformed/future/incomplete inputs fail closed.
2. **Replay-stable event identity:** SHA-256 of namespace, tenant scope, request identity, and most recent inbound timestamp. Retries and source-version increments for one inbound keep the same key; new inbound events get another key. Event keys contain no raw customer text, contact details or financial data.
3. **Atomic-ingress adapter contract** in src/server/workflows/sonic-f15-atomic-ingress.ts: strictly requires a durable transactional port. The adapter must re-read authoritative tenant/branch/source status, last response, and source version under a lock; enforce a unique composite event identity in one transaction; and return an exact save receipt. No adapter is wired in this PR. Without it, ingestion explicitly fails with F15_DURABLE_PORT_REQUIRED.
4. **Independent QA and Critic:** tests/ai/sonic-f15-unanswered-lead-sla.test.ts; sonic-f15-atomic-ingress.test.ts; sonic-f15-ingress-independent-critic.test.ts. Adversarial coverage includes forged source fields/getters, incomplete Inbox evidence, stale/cross-tenant receipts, false provider writes, invalid times, and mock racing retries. Mock concurrency is NOT live DB concurrency proof.

## Distinct implementation lanes and strict gates

- Source lane: authenticated saved request + complete current response projection; a partial loaded Inbox list cannot prove a customer was not answered.
- Policy lane: evaluate the SLA without contact, model, money or workflow engine side effects.
- Idempotency lane: transaction-local source CAS plus UNIQUE(workspace_id,branch_id,event_key). Never use an in-process Set as a production ledger.
- Integration lane: currently portless. Must implement an independently approved protected PostgreSQL adapter and migration, ensure RLS/ACL and signed-in OWNER A/B negative tests, and obtain separate live worker/tenant/deployment authorization. No new source event is published or dispatched in this batch.
- Critic lane: reject any success without a verified durable receipt, any ambiguous read, and any claim that queued equals executed, customer delivered or provider acknowledged.
- Release lane: leave ServiceDesk canonical/main, Supabase, Vercel, Render, and all devices untouched. P02 registration-guard authorization remains separately blocked. Do not merge original F15 source and a future F08–F15 composite twice.

**NEXT TASK:** Implement protected transactional DB adapter and a disposable PostgreSQL concurrency/rollback proof on a separately reviewed source candidate; real installation, scheduling, owner A/B UAT and provider activation require distinct owner approvals.

This feature is genuinely executable policy and adapter/receipt validation code but **NOT DURABLE IN PRODUCTION until a real atomic adapter exists**.