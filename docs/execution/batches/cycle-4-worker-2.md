# ServiceDesk AI — Cycle 4 Worker 2 / Connectors & AI — Delivery State Monotonicity

Branch: `feat/servicedesk-v1-connectors`
Expected previous HEAD: `af47a5623232c96062a06323b884b35801f41f0b`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

Make one quick normal Runtime recovery probe only. If pnpm/Git DNS is still blocked, immediately use Runtime Outage Mode.

## Objective
Harden WhatsApp delivery-status monotonicity so a terminal FAILED callback for one provider message cannot later be overwritten by delayed/reordered status callbacks.

Source-derived current files:
- `src/server/integrations/whatsapp/status-transition.ts`
- `src/server/integrations/whatsapp/status-batch.ts`
- `tests/providers/whatsapp-status-transition.test.ts`
- `tests/providers/whatsapp-status-batch.test.ts`

Current behavior allows a later PROVIDER_ACCEPTED/DELIVERED/READ callback to move state forward after current FAILED because FAILED has the lowest numeric order. For the same provider message identity this can erase terminal failure state after an out-of-order callback.

## CYCLE-4-W2-T1 — Package-free status harness
Add:
- `tests/providers/runtime-outage-whatsapp-status-harness.ts`

Use Node assert with the real status-transition/status-batch modules and execute via global `ts-node --transpile-only`.

Reproduce:
- normal PROVIDER_ACCEPTED → DELIVERED → READ;
- duplicate callback remains duplicate;
- older timestamp remains stale;
- current FAILED currently accepts a later non-failed callback.

## CYCLE-4-W2-T2 — Terminal FAILED policy
Harden `decideWhatsAppStatusTransition(...)` so once the current state for the same provider message is FAILED:
- exact callback duplicate remains DUPLICATE;
- equivalent same-state duplicate remains DUPLICATE where existing rules already apply;
- any later non-FAILED state is rejected as `STALE_REGRESSION`;
- use an explicit source-derived reason such as `STATUS_AFTER_TERMINAL_FAILURE` rather than overloading LOWER_ORDER_STATE.

Preserve:
- failure before confirmed delivery may transition PROVIDER_ACCEPTED → FAILED;
- FAILED received after DELIVERED/READ remains stale;
- normal forward progress before any terminal failure remains unchanged.

Do not create a new provider-message identity or retry-send behavior here. A new outbound provider message is a separate lifecycle.

## CYCLE-4-W2-T3 — Batch behavior
Verify `applyWhatsAppStatusBatch(...)`:
- never calls store.apply for status callbacks rejected after terminal FAILED;
- counts them as stale;
- still counts a first valid FAILED callback as applied+failed;
- preserves duplicate/stale counters across mixed batches.

Do not touch shared contracts, package files, API barrels, Core, Product/UI, or provider credentials.

## CYCLE-4-W2-T4 — Canonical tests
Extend canonical status transition/batch tests for:
- FAILED → PROVIDER_ACCEPTED rejected;
- FAILED → DELIVERED rejected;
- FAILED → READ rejected;
- repeated identical FAILED callback stays duplicate;
- mixed batch after terminal failure performs zero extra applies.

Run outage harness. If pnpm recovers, run focused WhatsApp status tests, full providers/AI suites and typecheck.

## Proof
Outage harness PASS supports `IMPLEMENTED`.
Without canonical Vitest/typecheck: `CANONICAL_GATE=CONFIGURATION_BLOCKED`.
No PROVIDER_VERIFIED claim.

## Receipt
Write `docs/execution/receipts/worker-2-cycle-4.md`.

Return worker/cycle/final SHA/receipt/state/canonical gate.
