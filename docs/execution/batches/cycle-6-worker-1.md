# ServiceDesk AI — Cycle 6 Worker 1 / Core — Backup: Repository Trust Boundaries

Planned branch: `feat/servicedesk-v1-core`
Activation rule: coordinator refreshes expected HEAD to Worker 1 Cycle 5 final before dispatch.

Read fast-start docs from the coordinator pin plus this packet. One recovery probe only; use outage mode if canonical access remains blocked.

## Completion quota
Complete at least FIVE substantive slices unless all remaining work is genuinely blocked. Use 2–3 grouped implementation commits + compact receipt.

## READY queue

### CYCLE-6-W1-T1 — Request repository response identity
Files:
- `src/server/core/request-repository.ts`
- `tests/db/request-repository-adapter.test.ts`

Fail closed when gateway returns a row that does not match the operation identity:
- findById: returned id/workspace must match requested id/workspace;
- insert/update: returned id/workspace must match the record being written.

Return typed repository/integrity failure; never map cross-workspace data as success.

### CYCLE-6-W1-T2 — Capacity repository workspace trust
Files:
- `src/server/core/capacity-repository.ts`
- `tests/db/capacity-repository-adapter.test.ts`

For find/list/hold results:
- every returned slot/hold must match requested workspace;
- findSlotById row id must equal requested slotId;
- listActiveHoldsForSlot rows must match requested slotId;
- insertHold returned row must match attempted hold id/workspace/slot/quote.

Any mismatch fails closed instead of returning foreign/incoherent records.

### CYCLE-6-W1-T3 — Visit repository response identity
Files:
- `src/server/core/visit-repository.ts`
- `tests/db/visit-repository-adapter.test.ts`

Require:
- findHoldById returned row matches requested workspace + hold id;
- findSlotById returned row matches requested workspace + slot id;
- insertVisit returned row matches attempted visit id/workspace/request/quote/slot/hold.

Fail closed with typed Result errors.

### CYCLE-6-W1-T4 — Quote repository identity checks
Files:
- `src/server/core/quote-repository.ts`
- `tests/db/quote-repository-adapter.test.ts`

Because repository methods currently return optional snapshots/void rather than Result:
- `findById(quoteId)`: throw a bounded repository integrity error if returned row.id differs;
- `findLatestByRequest(requestId)`: returned row.request_id must match requested requestId;
- `saveQuote(quote)`: if gateway returns data, returned id/workspace/request/version must match attempted quote;
- never silently map a mismatched row.

Do not redesign the shared QuoteRepository interface in this backup batch.

### CYCLE-6-W1-T5 — Mapping round-trip invariants
Across request/capacity/visit/quote adapter tests, add canonical round-trip assertions that optional/null fields and integer money/version state survive mapping without tenant/id drift.

Do not add DB claims; these are adapter contract tests.

### CYCLE-6-W1-T6 — Combined repository outage harness
Add:
- `tests/db/runtime-outage-repository-trust-harness.ts`

Exercise exact repository adapters with in-memory gateways:
- cross-workspace request row rejected;
- foreign capacity row rejected;
- wrong visit row identity rejected;
- wrong quote/request identity rejected;
- valid rows still round-trip.

Run with global ts-node.

## FALLBACK
F1. Ensure gateway error messages propagate without raw row/payload serialization.
F2. Verify missing-data cases remain NOT_FOUND, distinct from integrity mismatch.
F3. Add regression for null optional request fields round-tripping to undefined only at domain boundary.

## Proof
Outage PASS => IMPLEMENTED only. Canonical gate remains CONFIGURATION_BLOCKED until pnpm suites run.

## Receipt
`docs/execution/receipts/worker-1-cycle-6.md`
Compact format from high-throughput mode.
