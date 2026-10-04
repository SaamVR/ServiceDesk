# V1 Integration Sprint 3 — Worker 1 / Durable Outbox Runtime

Branch: `feat/servicedesk-v1-core-sprint3`
Exact base: `b744bbba9c02904a5981e09c8d064face0de4a90`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

The coordinator has frozen:
- `src/contracts/outbox.ts`
- `ClaimedOutboxEvent`
- `OutboxExecutionPort`
- `OutboxExecutionOutcome`

Do not modify shared contracts.

## Mission
Close V1 E04: durable outbox claim / lease / execute / retry / terminal handling.

One normal Runtime recovery probe only. Continue package-free in outage mode if needed.

## Required slices

### INT3-W1-T1 — Durable outbox runtime schema
Add:
- `supabase/migrations/0006_outbox_worker_runtime.sql`

Extend current outbox persistence for worker runtime.

Required:
- explicit terminal `SUPPRESSED` state or an equally honest non-SENT terminal representation;
- provider_reference nullable;
- last_error_code nullable;
- updated lock metadata support;
- indexes for ready-to-claim and stale-lease reclamation;
- no public/client mutation authority.

Implement an atomic SQL claim primitive suitable for Postgres:
- claim PENDING rows only;
- next_attempt_at null or <= now;
- unlocked OR lease expired;
- `FOR UPDATE SKIP LOCKED`;
- bounded limit;
- set locked_at + locked_by atomically;
- return claimed rows.

Do not depend on GitHub Actions/cron for correctness.

### INT3-W1-T2 — Outbox repository
Add:
- `src/server/jobs/outbox-repository.ts`

Port must support:
- claimReady(workerId, now, leaseSeconds, limit)
- markSent(eventId, workerId, completedAt, providerReference?)
- markRetry(eventId, workerId, failedAt, nextAttemptAt, nextAttemptCount, errorCode)
- markFailed(eventId, workerId, failedAt, attempts, errorCode)
- markSuppressed(eventId, workerId, failedAt, attempts, code)

All completion/update methods must verify lease owner.
No stale worker may complete another worker's claim.

### INT3-W1-T3 — Deterministic retry policy
Add:
- `src/server/jobs/outbox-retry.ts`

Rules:
- attempt count increments once per claimed execution attempt;
- retryable outcome schedules deterministic exponential backoff;
- explicit retryAfterSeconds may lengthen but not shorten the minimum backoff;
- max attempts => FAILED;
- SENT => terminal;
- TERMINAL_FAILURE => FAILED immediately;
- SUPPRESSED => terminal non-sent state;
- invalid timestamps/config fail closed.

Preserve existing outbox idempotency keys.

### INT3-W1-T4 — Worker executor
Add:
- `src/server/jobs/outbox-worker.ts`

Implement:
`runOutboxBatch({repository, executor, workerId, now, leaseSeconds, maxAttempts, limit})`

Flow:
1. claim ready batch atomically;
2. convert claimed DB/domain event to frozen `ClaimedOutboxEvent`;
3. call injected `OutboxExecutionPort.execute`;
4. persist SENT / retry / FAILED / SUPPRESSED;
5. continue remaining claimed items even if one item fails;
6. return summary counts and per-item redacted codes.

If executor returns Result error, treat as retryable execution infrastructure failure subject to maxAttempts.

Do not put provider implementation in Core.

### INT3-W1-T5 — Lease recovery and competing-worker semantics
Canonical/harness coverage:
- Worker A claims row;
- Worker B cannot claim before lease expiry;
- Worker B may reclaim after lease expiry;
- Worker A can no longer mark reclaimed row sent;
- two workers cannot successfully complete same claim;
- sent/failed/suppressed rows are never reclaimed.

### INT3-W1-T6 — Retry/terminal semantics
Cover:
- retryable failure schedules next attempt;
- retryAfterSeconds honored as lower bound;
- max attempt becomes FAILED;
- terminal failure immediately FAILED;
- suppressed becomes SUPPRESSED and never provider-sent;
- success records providerReference and sentAt;
- completion clears lock.

### INT3-W1-T7 — Package-free worker harness
Add:
- `tests/db/runtime-outage-e04-outbox-worker-harness.ts`

Use real worker/retry modules and an in-memory repository with lease semantics.
Run global ts-node.

### INT3-W1-T8 — Canonical DB tests
Author:
- migration/claim SQL structural test;
- repository contract tests;
- worker behavior tests;
- concurrency/lease tests.

If pnpm recovers, run focused suites + db/typecheck.

If source is complete and only real Postgres claim/concurrency proof remains, report:
`SUPABASE_STAGING_REQUIRED_FOR_E04_DB_PROOF`

## Continue rule
Complete all independent T1–T8 work. Do not return after adding the SQL claim function.

## Receipt
`docs/execution/receipts/v1-int3-worker-1.md`

Return:
WORKER=1
SPRINT=V1-INT3
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E05 inbox conversation handover core
