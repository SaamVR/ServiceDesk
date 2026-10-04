# V1 Integration Sprint 1 — Worker 3 / Server-Backed Product Preparation

Branch: `feat/servicedesk-v1-product-sprint1`
Exact base: `714f24edfe7c6124237c7259a00ede7b288b68fb`
RC lineage: `rc/servicedesk-v1-unverified-20261004`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- this packet

## Mission
Do not add pages or cosmetic features. Convert the already-built V1 Product surfaces from module-owned fixtures into reusable DTO/props boundaries ready for Worker 1's server entrypoints.

One normal Runtime recovery probe only. In outage mode, React/browser execution remains blocked; use source-boundary/static package-free checks.

## Required slices

### INT1-W3-T1 — Quote preview props boundary
Refactor `QuoteApprovalPreview.tsx` so the reusable component accepts:
- request: RequestDTO
- currentQuote: QuoteDTO
- previousQuote?: QuoteDTO

Move sample-data ownership into an explicit fixture wrapper.

No sample-data import in the reusable component.

### INT1-W3-T2 — Schedule preview props boundary
Refactor `SchedulePreview.tsx` to accept:
- slot
- optional visit
- integrations
- attentionItems

Keep fixture data in a separate wrapper only.

### INT1-W3-T3 — Checkout preview props boundary
Refactor `CheckoutPreview.tsx` to accept:
- quote
- slot
- visit
- invoice
- paymentMode
- holdExpiresAt

Keep business truth read-only. No provider call/server action yet. Fixture wrapper remains explicit.

### INT1-W3-T4 — Invoice + CRM props boundaries
Refactor reusable `InvoiceLedgerPreview` and `CrmPreview` away from direct sample-data ownership.

Keep explicit fixture wrappers for showcase routes.

### INT1-W3-T5 — Crew job props boundary
Refactor `CrewJobPreview` to consume accepted DTO props rather than module-owned fixture imports.

Do not enable mutations yet.

### INT1-W3-T6 — Route dependency map
Create:
- `src/features/operations/server-wiring-map.ts` or a Product-owned docs/test equivalent

Map current V1 routes to the exact accepted server commands/snapshots they need:
- enquiry → create/update request + calculateQuote;
- quote → sendQuote;
- schedule → findSlots + holdSlot;
- checkout → future E03 payment/checkout bridge;
- portal → future readWorkspaceSnapshot/property read;
- crew → future transitionVisit.

This is a typed/static dependency map, not a fake server implementation.

### INT1-W3-T7 — Static fixture-boundary harness
Add package-free Node/source assertions proving reusable production-capable components above do not import `sample-data`, while named fixture wrappers do.

Also assert disabled actions remain disabled where server commands do not yet exist.

If pnpm recovers, run focused Product tests/typecheck/build.

## Continue-until rule
Complete T1–T7. If one component is blocked, continue the others. Do not return after a single props refactor.

## Output
2–3 implementation commits + compact receipt:
`docs/execution/receipts/v1-int1-worker-3.md`

Return:
WORKER=3
SPRINT=V1-INT1
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=wire enquiry/quote/schedule to accepted Worker 1 entrypoints
