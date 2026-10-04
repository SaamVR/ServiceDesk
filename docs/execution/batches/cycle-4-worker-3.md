# ServiceDesk AI — Cycle 4 Worker 3 / Product & UI — Payment Receipt Truth Boundaries

Branch: `feat/servicedesk-v1-product`
Expected previous HEAD: `caea4ba4bc7e7a3ebb1cedd30e25de044179542d`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

Make one quick normal Runtime recovery probe only. If pnpm/Git DNS is still blocked, immediately use Runtime Outage Mode.

React/Next/browser-dependent work remains frozen while canonical tooling is unavailable. This cycle owns pure view-model logic only.

## Objective
Fail closed when payment/receipt display inputs are internally inconsistent. Product/UI must never imply verified payment or final receipt state from a partial/incoherent DTO combination.

Source-derived current files:
- `src/features/checkout/view-models.ts`
- `src/features/invoices/view-models.ts`
- `tests/e2e/checkout-view-model.test.ts`
- `tests/e2e/invoice-ledger-view-model.test.ts`

## CYCLE-4-W3-T1 — Package-free payment view-model harness
Add:
- `tests/e2e/runtime-outage-payment-view-model-harness.ts`

Use Node assert and the real checkout/invoice view-model modules. Execute via global `ts-node --transpile-only`.

Baseline cases:
- sandbox/fixture checkout never exposes receipt proof;
- stale slot still blocks instant flow;
- PAYMENT_REVIEW routes to review;
- partially paid invoice does not show final receipt.

## CYCLE-4-W3-T2 — Checkout receipt fail-safe
Current `canShowReceipt` is true for LIVE + depositRecorded + !PAYMENT_REVIEW even when quote/slot/visit state is incoherent.

Harden it so receipt visibility requires all of:
- `paymentMode === "LIVE"`;
- deposit is recorded;
- quote status is `ACCEPTED`;
- slot availability is fresh;
- visit status is `CONFIRMED` or `ASSIGNED`;
- visit is not PAYMENT_REVIEW.

If those conditions are not coherent, fail closed and keep receipt hidden.

Do not claim this proves a provider callback; the existing warning/boundary language must continue to require provider evidence.

## CYCLE-4-W3-T3 — Invoice progress/final receipt fail-safe
In `buildInvoiceLedgerView(...)`:
- clamp displayed collection percentage to 0–100 even if inconsistent supplied accounting fields over-allocate;
- final receipt may be shown only when status is PAID, balance is zero, and net paid amount (`allocatedMinor - refundedMinor`) is at least totalMinor;
- inconsistent `PAID` DTOs with insufficient net paid amount must fail closed.

Preserve existing money labels and ledger rows.

## CYCLE-4-W3-T4 — Canonical regressions
Add tests covering:
- LIVE + deposit recorded + AWAITING_PAYMENT => no checkout receipt;
- LIVE + accepted quote + stale slot => no receipt;
- LIVE + accepted/fresh + CONFIRMED + deposit recorded => receipt eligible;
- PAID + zero balance but insufficient net allocation => no final receipt;
- over-allocation/refund combinations never show >100% collected;
- coherent fully paid invoice still shows final receipt.

Run outage harness. If pnpm recovers, run focused checkout/invoice tests, Product suite, typecheck/lint/build/browser smoke.

## Restrictions
No React route changes, server actions, shared contracts or provider claims in outage mode.

## Proof
Outage harness PASS supports `IMPLEMENTED`.
Without canonical tooling: `CANONICAL_GATE=CONFIGURATION_BLOCKED`.
Do not claim CONTRACT_TESTED or provider verification.

## Receipt
Write `docs/execution/receipts/worker-3-cycle-4.md`.

Return worker/cycle/final SHA/receipt/state/canonical gate.
