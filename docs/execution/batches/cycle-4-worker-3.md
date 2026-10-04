# ServiceDesk AI — Cycle 4 Worker 3 / Product UI — invoice truth hardening

Branch: `feat/servicedesk-v1-product`
Expected previous HEAD: `caea4ba4bc7e7a3ebb1cedd30e25de044179542d`

Read in full from the exact coordinator ref supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify remote branch HEAD and preserve every legitimate newer Product/UI commit.

Perform only one quick normal Runtime recovery probe. If the package stack remains blocked, immediately use Runtime Outage Mode.

React/Next/browser work remains frozen during outage mode. This batch is pure Product view-model logic.

## Source-derived defect

Current `src/features/invoices/view-models.ts` calculates:

`collectedPercent = Math.round(((allocatedMinor - refundedMinor) / totalMinor) * 100)`

after clamping only the lower bound of paidMinor.

If inconsistent upstream data has net allocations greater than invoice total, Product UI can display more than `100% collected`.

Also, `canShowFinalReceipt` currently trusts only `status === "PAID"` plus zero balance. A contradictory invoice could therefore expose a final-receipt state without net collected amount covering the invoice total.

## CYCLE-4-W3-T1 — Bound invoice collection truth
Update only pure invoice view-model logic.

Requirements:
1. Net paid remains `max(allocatedMinor - refundedMinor, 0)`.
2. Progress percentage must be clamped to `0..100`.
3. A zero or negative total must never produce Infinity/NaN or a positive collection percentage.
4. `canShowFinalReceipt` must require:
   - invoice status `PAID`;
   - `balanceMinor === 0`;
   - net paid amount is at least the positive invoice total.
5. Keep current labels and normal sample behavior unchanged.

Do not infer provider verification. This remains UI state derived from supplied InvoiceDTO only.

## CYCLE-4-W3-T2 — Canonical regression tests
Update `tests/e2e/invoice-ledger-view-model.test.ts` with:
- normal partial invoice remains 25%;
- over-allocated invoice displays 100%, not >100%;
- refund greater than allocation displays 0%;
- contradictory `PAID` + zero balance + insufficient net paid does not show final receipt;
- valid fully paid invoice can show final receipt;
- zero-total malformed/edge input remains bounded and does not claim a receipt.

## CYCLE-4-W3-T3 — Outage harness
Add:
`tests/e2e/runtime-outage-invoice-view-model-harness.ts`

Use Node `assert` and the real `src/features/invoices/view-models.ts`.
Run with global `ts-node --transpile-only`.

If pnpm recovers, run:
- `pnpm vitest run tests/e2e/invoice-ledger-view-model.test.ts`
- relevant Product view-model tests;
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

## Restrictions
- Pure Product view-model + tests only.
- No React/Next route changes in outage mode.
- No server actions, contracts, provider code, or Core files.
- No provider/browser/build verification claim unless canonical tooling actually runs.

## Proof
Outage harness PASS permits `IMPLEMENTED`.
Canonical gate remains `CONFIGURATION_BLOCKED` until pnpm/Vitest/typecheck/build are restored.

## Receipt
Write:
`docs/execution/receipts/worker-3-cycle-4.md`
