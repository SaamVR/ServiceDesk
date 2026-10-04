# ServiceDesk AI — Cycle 5 Worker 1 / Core — Long-Run Integrity Batch

Branch: `feat/servicedesk-v1-core`
Expected previous HEAD: `6c062755a8d5f5e75051527a71687b98fa3070d7`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/high-throughput-mode-v2-20261004.md`
- this packet

Do one quick normal-runtime probe. If canonical package access remains unavailable, enter outage mode immediately.

## Completion quota

Do NOT return after one or two fixes.

Before writing the receipt, complete at least FIVE substantive slices below unless every remaining slice is genuinely blocked. If the READY queue completes, continue into FALLBACK automatically.

Prefer 2–3 grouped implementation commits plus one compact receipt commit.

## READY queue

### CYCLE-5-W1-T1 — Request field validation

Current source:
- `src/server/core/requests.ts`
- `tests/db/request-commands.test.ts`

Harden create + update request paths so:
- bedrooms and bathrooms, when present, must be integers in the same 0–10 range already used by shared request DTO validation;
- requestedStartAt, when present, must be a valid timestamp;
- requestedStartAt earlier than `meta.now` is rejected for create/update;
- invalid values return typed Result failures rather than being persisted.

Preserve optional/missing fields.

### CYCLE-5-W1-T2 — Visitor status-mutation authority

`RequestPatch` currently includes `status`, and a correctly scoped VISITOR can therefore mutate request lifecycle state.

Harden `updateRequestRecord(...)` so:
- VISITOR may update owned intake fields;
- VISITOR may not directly patch `status`;
- OWNER/DISPATCHER behavior stays authorized;
- cross-workspace and visitor-session guards remain unchanged.

Add regression proving a visitor cannot set QUOTED/BOOKED/CLOSED on its own request.

### CYCLE-5-W1-T3 — Quote repository identity fail-closed

Current:
- `src/server/core/quotes.ts`
- `tests/db/quote-commands.test.ts`

In `createQuoteDraftWithRepository(...)`, fail closed if `findLatestByRequest(input.requestId)` returns a quote whose:
- `requestId` is not the requested request id, or
- `workspaceId` is not `input.workspaceId`.

Do not supersede or save after such mismatch.

Keep normal version increment and supersede behavior for a valid same-request/same-workspace previous quote.

### CYCLE-5-W1-T4 — Quote expiry boundary

In `acceptQuoteByIdWithRepository(...)`:
- acceptance at exactly `validUntil` must be expired;
- invalid/non-finite `meta.now` or `validUntil` timestamps must fail closed instead of comparing as NaN and accepting;
- sent/unexpired expected-version acceptance remains unchanged.

Add canonical regressions.

### CYCLE-5-W1-T5 — Visit repository identity/scope hardening

Current:
- `src/server/core/visits.ts`
- `tests/db/visits.test.ts`

After repository reads, fail closed unless:
- returned hold.workspaceId equals authorized workspace;
- returned hold.id equals requested holdId;
- returned slot.workspaceId equals authorized workspace;
- returned slot.id equals hold.slotId;
- slot starts in the future relative to `meta.now`;
- slot end is after slot start;
- timezone is non-empty after trim.

No confirmHold/insertVisit call may occur after any mismatch.

Preserve active-hold and quote-id checks.

### CYCLE-5-W1-T6 — Combined Core outage harness

Add:
- `tests/db/runtime-outage-core-integrity-harness.ts`

Use Node assert and the exact changed Core source.

Cover at minimum:
- invalid request counts/date rejected;
- visitor lifecycle mutation rejected;
- wrong previous quote identity rejected with zero save/supersede;
- exact quote expiry rejected;
- invalid quote timestamp rejected;
- wrong hold workspace/id rejected;
- wrong slot workspace/id rejected;
- past slot rejected;
- valid request/quote/visit happy paths remain usable.

Run with global `ts-node --transpile-only`.

## FALLBACK queue

If READY finishes early:

F1. Add canonical regression that repository failure from `updateRequestWithRepository` propagates unchanged and does not fabricate a request.

F2. Add canonical regression that `scheduleVisitFromHoldWithRepository` does not call `insertVisit` when `confirmHold` fails.

F3. Audit only the touched Core command files for generated IDs that are empty/whitespace. If an empty ID can produce an authoritative record, add fail-closed validation plus harness/test coverage.

## Canonical gate

If pnpm becomes available, run focused request/quote/visit tests, then `pnpm test:domain`, `pnpm test:db`, and `pnpm typecheck`.

If still unavailable:
- outage harness PASS => `STATE=IMPLEMENTED`;
- `CANONICAL_GATE=CONFIGURATION_BLOCKED`;
- do not claim DB/RLS/OPERATIONS_VERIFIED/CONTRACT_TESTED.

## Receipt

Write compact:
`docs/execution/receipts/worker-1-cycle-5.md`

Include completed slice IDs and READY_NEXT. Do not restate the packet.
