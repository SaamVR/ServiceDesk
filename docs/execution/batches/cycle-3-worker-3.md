# ServiceDesk AI — Cycle 3 Worker 3 / Product & UI — Outage Mode

Branch: `feat/servicedesk-v1-product`
Expected previous HEAD: `739a60b9c170f97cc67137744e9aaf0927c2852d`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify remote branch HEAD and preserve legitimate newer work.

Make only ONE quick normal Runtime recovery probe. If the package stack remains unavailable, enter outage mode immediately.

React/Next/JSX behavior remains frozen while build/browser tooling is unavailable. This cycle owns pure Product view-model logic only.

## CYCLE-3-W3-T1 — Package-free Product harness
Add:
- `tests/e2e/runtime-outage-product-view-model-harness.ts`

Use Node `assert` and the real pure view-model modules. Run with global `ts-node --transpile-only`.

At minimum exercise:
- request-intake summary missing-field blocking;
- operations money/queue/crew view-model logic;
- schedule freshness / instant-confirm gating;
- reporting conversion / collection / capacity logic.

Do not import React components into the outage harness.

## CYCLE-3-W3-T2 — Fix reporting conversion truth boundary
Current `src/features/reports/view-models.ts` computes booked count using:

`Math.max(bookedRequests, new Set(visits.map(visit => visit.requestId)).size)`

This can inflate conversion above 100% when supplied visits reference request IDs absent from the supplied request set.

Replace it with request-truth-bounded logic:
1. build the set of supplied request IDs;
2. seed booked IDs from supplied requests in `BOOKED` or `CLOSED`;
3. add `visit.requestId` only when that ID exists in the supplied request set;
4. booked count = size of the resulting set.

This must keep duplicate visits for one request from double-counting and must ignore orphan visits for conversion.

Do not change scheduled-capacity calculations: visits remain valid input for capacity even when their request row is absent.

## CYCLE-3-W3-T3 — Canonical regression cases
Update `tests/e2e/reporting-view-model.test.ts` with at least:
- one supplied request + two orphan visits => conversion 0%, never >100%;
- duplicate visits for one supplied request => conversion 100%, not 200%;
- zero supplied requests remains `No data` even if visit records exist.

Run the outage harness against the exact changed view-model.

If pnpm recovers, run:
- focused reporting/view-model tests;
- the previously required Product e2e suite;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build`;
- browser route smoke.

## Restrictions
Do not modify React/Next route behavior in outage mode.
Do not add server actions or invent shared facade/contracts.
No browser/build/accessibility-runtime claim without normal tooling.

## Proof
Outage harness PASS permits `IMPLEMENTED`.
Canonical Product test/build/browser gate remains `CONFIGURATION_BLOCKED` until pnpm stack is restored.
Do not claim `CONTRACT_TESTED` from the outage harness alone.

## Receipt
Write `docs/execution/receipts/worker-3-cycle-3.md`.

Return:
`WORKER=3`
`CYCLE=3`
`FINAL_SHA=<sha>`
`RECEIPT=docs/execution/receipts/worker-3-cycle-3.md`
`STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>`
`CANONICAL_GATE=<state>`
