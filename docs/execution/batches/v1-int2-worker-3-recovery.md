# V1 Integration Sprint 2 — Worker 3 RECOVERY / Product Server Boundary

Branch: `feat/servicedesk-v1-product-sprint2`
Expected current HEAD: `dae3150f9145b3acd2f69c27ada1dab1ba30221f`
Original base: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this recovery packet

## Situation
Your prior INT2 run completed only the structural first half:
- route-data.ts
- OperationalRoute props refactor
- OperationalFixtureRoute
- fixture-wrapper page migration

Missing:
- enquiry action adapter;
- quote/schedule action adapters;
- action-state mapping;
- static server-boundary harness;
- canonical tests;
- receipt.

The partial `OperationalRoute` also regressed existing module rendering: reports, billing, quality, recovery, settings, inbox, properties/preferences, onboarding and tour were replaced/funneled into generic boundary behavior.

Do not restart from scratch.
Preserve the useful partial work and finish/reconcile it.

## RECOVERY-R1 — Preserve existing V1 module coverage
Use the original base version at `35114c64...` as reference.

Restore existing rendering for:
- business home;
- customer properties/preferences;
- staff inbox/reports/billing/quality/automations/settings/jobs;
- onboarding;
- tour.

Do this without reintroducing `sample-data` imports into reusable `OperationalRoute`.

Where a legacy feature component is internally fixture-backed, it may remain clearly fixture/demo labelled for now; do not delete the module just to satisfy central-route purity.

## RECOVERY-R2 — Finish enquiry server action
Add dependency-injected route/server action factory under:
`src/app/b/[slug]/enquire/`

Orchestration:
createRequest -> updateRequest -> calculateQuote.

Use accepted command types only.
No repository/provider access.
Stop on first failure.
Return serializable authoritative DTOs/error.

## RECOVERY-R3 — Quote/schedule adapters
Add dependency-injected route/server adapters for:
- sendQuote
- findSlots
- holdSlot

Exact delegation/error propagation.
No provider call.
No hosted checkout.

## RECOVERY-R4 — Product action-state mapping
Add pure mapping for:
- success;
- VERSION_CONFLICT;
- authorization/workspace/visitor errors;
- quote not found;
- slot/hold failure;
- generic server failure.

No optimistic local business-truth mutation.

## RECOVERY-R5 — Static server-boundary harness
Add:
`tests/e2e/runtime-outage-product-server-boundary-harness.ts`

Prove:
- OperationalRoute imports no sample-data;
- OperationalFixtureRoute owns central sample-data;
- existing route families remain represented;
- action factories import no provider adapters/Core repositories;
- enquiry order create -> update -> calculate;
- failures prevent later calls;
- quote/schedule delegate once;
- unsupported checkout/crew mutations remain disabled.

Run via global ts-node/source assertions.

## RECOVERY-R6 — Canonical tests
Author focused tests for action orchestration and action-state mapping.

## RECOVERY-R7 — Receipt
Write:
`docs/execution/receipts/v1-int2-worker-3.md`

Do not return without the receipt.

## Completion rule
This recovery is incomplete unless R1–R7 are done or a real blocker prevents the remaining independent tasks.

Return:
WORKER=3
SPRINT=V1-INT2-RECOVERY
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<R1-R7>
BLOCKERS=<exact blockers>
READY_NEXT=real runtime snapshot wiring after E05
