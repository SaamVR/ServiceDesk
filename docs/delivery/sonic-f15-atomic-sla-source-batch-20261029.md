# SONIC F15 — Unanswered-lead SLA & atomic internal ingress contract

**Date:** 2026-10-29
**Status:** SOURCE-ONLY DRAFT. Not installed, wired to a scheduler, merged, deployed or verified with a live tenant.

## Implemented in this batch

1. **Saved-evidence SLA evaluator** in src/server/workflows/sonic-f15-unanswered-lead-sla.ts: takes strictly allowlisted request and message-history facts. Requires an actual request/workspace/branch UUID, saved integer source version, complete response-history attestation, coherent ISO instants and bounded 15–1440 minute threshold. NEW/COLLECTING/NEEDS_REVIEW requests become an UNPERSISTED_SLA_CANDIDATE only if the last inbound is overdue and not answered afterward. Malformed/future/incomplete inputs fail closed.
2. **Replay-stable event identity:** SHA-256 of namespace, tenant scope, request identity, and authoritative saved inbound message ID. Retries, timestamp corrections and source-version increments for one inbound keep the same key; distinct messages with identical timestamps receive distinct keys. Event keys contain no raw customer text, contact details or financial data.
3. **Atomic-ingress adapter contract** in src/server/workflows/sonic-f15-atomic-ingress.ts: strictly requires a durable transactional port. The adapter must re-read authoritative tenant/branch/source status, last response, and source version under a lock; enforce a unique composite event identity in one transaction; and return an exact save receipt. No adapter is wired in this PR. Without it, ingestion explicitly fails with F15_DURABLE_PORT_REQUIRED.
4. **Independent QA and Critic:** tests/ai/sonic-f15-unanswered-lead-sla.test.ts; sonic-f15-atomic-ingress.test.ts; sonic-f15-ingress-independent-critic.test.ts. Adversarial coverage includes forged source fields/getters, incomplete Inbox evidence, stale/cross-tenant receipts, false provider writes, invalid times, and mock racing retries. Mock concurrency is NOT live DB concurrency proof.

## Distinct implementation lanes and strict gates

- Source lane: authenticated saved request + complete current response projection; a partial loaded Inbox list cannot prove a customer was not answered.
- Policy lane: evaluate the SLA without contact, model, money or workflow engine side effects.
- Idempotency lane: transaction-local source CAS plus UNIQUE(workspace_id,branch_id,event_key). Never use an in-process Set as a production ledger.
- Integration lane: a narrow PostgreSQL RPC client adapter is now authored as sonic-f15-postgres-port.ts, but NO RPC FUNCTION exists in the approved database and NO production route or worker constructs it. Missing or denied RPCs fail closed. Independently reviewed SQL migration, transactional status/response rechecks, RLS/ACL and real OWNER A/B negative tests are required before worker activation. No new source event is published or dispatched in this batch.
- Critic lane: reject any success without a verified durable receipt, any ambiguous read, and any claim that queued equals executed, customer delivered or provider acknowledged.
- Release lane: leave ServiceDesk canonical/main, Supabase, Vercel, Render, and all devices untouched. P02 registration-guard authorization remains separately blocked. Do not merge original F15 source and a future F08–F15 composite twice.

**NEXT TASK:** Implement the protected transactional DB function and disposable PostgreSQL concurrency/rollback proof on a separately reviewed source candidate; real installation, scheduling, owner A/B UAT and provider activation require distinct owner approvals.

This feature is genuinely executable policy and adapter/receipt validation code but **NOT DURABLE IN PRODUCTION until a real atomic adapter exists**.
5. **Unwired PostgreSQL RPC adapter:** src/server/workflows/sonic-f15-postgres-port.ts is an injectable backend-only implementation of the event-port client boundary. It sends only fixed PII-free event fields to a named function that is NOT installed, never bypasses the validated receipt, and cannot make a missing RPC appear successful. The extra sonic-f15-postgres-port.test.ts suite covers RPC input allowlisting, no outbound data, missing function/permissions, false success and not-due denial. This adapter is NOT evidence of an installed database function.

## Message identity critic refinement

F15 requires the immutable saved lastInboundMessageId UUID for each source. A timestamp alone is not a durable identity: two inbound messages can share a timestamp. The event fingerprint includes the message ID (not a mutable source version or a PII field); the transaction receipt verifies the exact same message ID plus its saved timestamp/version. PostgreSQL must atomically recheck both the message row and request/reply status against database clock_timestamp(), never trust client-observed time as authorization.

## Request enum reconciliation

The canonical migration 0001_core.sql defines request_status as NEW, COLLECTING, READY, NEEDS_REVIEW, QUOTED, BOOKED, LOST, CLOSED. F15 only escalates NEW/COLLECTING/NEEDS_REVIEW with complete saved no-answer evidence. READY, QUOTED, BOOKED, LOST and CLOSED deliberately do not imply an unanswered-lead SLA. No nonexistent OPEN or REPLIED state may be emitted to the database.

## Timestamp compatibility refinement

The SLA evaluator now reuses canonical trustedQuoteInstant from quote-validity-clock.ts to parse strictly zoned, calendar-validated PostgreSQL TIMESTAMPTZ values with fractional seconds and timezone offsets. This replaces a narrower UTC-millisecond-only parser that would have rejected real saved rows. The message UUID remains the idempotency identity; exact source timestamp/version must still be rechecked by the future DB transaction.
