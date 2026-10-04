# V1 Integration Sprint 2 — Worker 1 / Atomic Payment Core

Branch: `feat/servicedesk-v1-core-sprint2`
Exact base: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

One normal Runtime recovery probe only. If canonical package access remains blocked, continue in outage mode.

## Mission
Close V1 E03: authoritative verified-payment application.

Stripe is SANDBOX/DEMO only. Do not wait for live Stripe access.

The coordinator has frozen the shared Core contract in this base:
- `VerifiedPaymentEvent` now carries optional `quoteId`, `holdId`, `invoiceId`.
- `VerifiedPaymentApplicationState = APPLIED | DUPLICATE | PAYMENT_REVIEW`.
- `ServiceDeskFacade.applyVerifiedPayment` returns `VerifiedPaymentApplicationOutcome`.

Do not edit shared contracts/facade unless a compile-blocking defect is found; report it to coordinator instead.

## Required slices

### INT2-W1-T1 — Invoice/payment persistence migration
Add next migration:
`supabase/migrations/0005_invoices_payment_applications.sql`

Create authoritative V1 persistence for:
- invoices;
- verified payment applications/review records.

Minimum invoice fields must map exactly to current `InvoiceDTO` plus quote linkage/version/timestamps:
- id/workspace_id/quote_id/visit_id
- status DRAFT|ISSUED|PARTIALLY_PAID|PAID|VOID
- currency
- total_minor
- allocated_minor
- refunded_minor
- balance_minor
- version
- created_at/updated_at

Require nonnegative integer money, allocated >= refunded, and net-paid + balance = total.

Payment application rows must persist:
- provider/account/event/transaction identity
- workspace
- purpose
- quoteId/holdId/invoiceId references when present
- amount/currency/occurredAt
- state APPLIED|REVIEW
- reason code
- createdAt

Enforce idempotency for provider event identity AND provider transaction+purpose within workspace/account.

RLS:
- staff/customer reads only where justified;
- authoritative writes remain trusted server/service role;
- do not add broad anonymous mutation policies.

### INT2-W1-T2 — Payment domain + repository transaction port
Add Core-owned payment domain/repository modules, suggested:
- `src/domain/payments.ts`
- `src/server/core/payment-application-repository.ts`

Define typed invoice/payment records and an injected transaction/unit-of-work boundary.

The transaction boundary must be capable of atomically coordinating:
- payment application identity lookup/insert;
- quote/hold/slot reads;
- invoice create/update;
- visit creation/lookup where eligible;
- ledger append;
- outbox enqueue;
- attention/review creation.

Do not pretend independent repository writes are atomic.

### INT2-W1-T3 — Deposit application
Add:
- `src/server/core/payment-application.ts`

For `DEPOSIT`:
- require quoteId + holdId;
- load same-workspace quote/hold/slot;
- quote must be ACCEPTED;
- hold must belong to quote/workspace;
- amount must equal quote.depositMinor;
- currency must match quote.currency;
- provider identity fields/timestamp must be valid;
- verified payment occurring after hold expiry must NOT confirm booking;
- valid deposit creates/updates invoice allocation;
- valid active hold becomes confirmed/scheduled visit exactly once;
- append CREDIT ledger entry exactly once;
- enqueue booking/payment confirmation outbox exactly once;
- persist APPLIED payment application exactly once.

Frozen fixture acceptance:
$340 total / $85 deposit / $255 balance / 240m + 30m buffer / 15m hold.

### INT2-W1-T4 — Duplicate, mismatch and late-payment review
If the same provider event or same provider transaction+purpose was already applied with materially identical facts:
- return DUPLICATE;
- perform zero second ledger/invoice/visit/outbox mutation.

If same identity conflicts materially OR workspace/quote/hold/amount/currency/purpose is inconsistent:
- state PAYMENT_REVIEW;
- persist deduplicated payment review/application record;
- raise deduplicated attention item;
- do NOT confirm visit or enqueue booking confirmation.

Late verified deposit after hold expiry:
- PAYMENT_REVIEW;
- no false booking confirmation.

### INT2-W1-T5 — Balance application
For `BALANCE`:
- require invoiceId;
- same workspace;
- invoice not VOID/PAID;
- currency match;
- amount must equal authoritative remaining balance;
- apply net allocation;
- mark PAID at zero balance;
- ledger once;
- receipt/outbox once;
- duplicate transaction remains duplicate.

If invoiceId is absent or balance facts mismatch, route to PAYMENT_REVIEW rather than guessing.

`PLATFORM_SUBSCRIPTION` is outside customer-service invoice mutation in E03; fail closed into review/unsupported authoritative path. E09 owns platform billing.

### INT2-W1-T6 — Facade/server composition
Add `createPaymentApplicationFacadeMethods` implementing existing `ServiceDeskFacade.applyVerifiedPayment`.

Extend the server command composition with an injected:
`applyVerifiedPaymentCommand(event)`

Do not couple provider code into Core.

### INT2-W1-T7 — Package-free atomicity harness
Add:
`tests/db/runtime-outage-e03-payment-application-harness.ts`

In-memory transaction repository must prove:
- valid $85 deposit => APPLIED once;
- same event duplicate => no second mutation;
- same transaction under another callback => no second mutation;
- amount/currency/workspace mismatch => PAYMENT_REVIEW;
- expired hold => PAYMENT_REVIEW and no visit confirmation;
- valid balance closes invoice exactly once;
- transaction failure rolls back the in-memory unit of work;
- platform subscription does not mutate customer invoice.

### INT2-W1-T8 — Canonical tests / DB proof handoff
Author focused canonical tests for migration mappings, application semantics, rollback/idempotency and facade composition.

If pnpm recovers, run focused suites + domain/db/typecheck.

Actual PostgreSQL/Supabase transaction/RLS proof may remain blocked. If source implementation is complete and that is the only remaining gate, return:
`SUPABASE_STAGING_REQUIRED_FOR_E03_DB_PROOF`
so the coordinator can ask the owner just-in-time.

## Continue rule
Do not return after migration or pure domain only. Complete all independent T1–T8 work.

## Receipt
`docs/execution/receipts/v1-int2-worker-1.md`

Return:
WORKER=1
SPRINT=V1-INT2
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E04 durable outbox claim lease retry worker
