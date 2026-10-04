# V1 Integration Sprint 2 — Worker 2 / Stripe Sandbox → Core Bridge

Branch: `feat/servicedesk-v1-connectors-sprint2`
Exact base: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

One normal Runtime recovery probe only; use outage mode if canonical tooling remains blocked.

## Mission
Complete the provider side of E03 against the coordinator-frozen Core payment contract.

Stripe for V1 is OFFICIAL-SHAPE SANDBOX/DEMO ONLY.
Do not request live Stripe access or live credentials.
Do not claim PROVIDER_VERIFIED.

## Required slices

### INT2-W2-T1 — Preserve authoritative payment references
Current checkout already emits Stripe-style metadata:
- workspaceId
- quoteId
- holdId
- purpose

Update sandbox webhook/lifecycle normalization so verified Core events preserve these references.

For DEPOSIT:
- quoteId and holdId are required metadata;
- missing either => typed verification failure before Core.

For BALANCE:
- invoiceId is required metadata for authoritative Core allocation;
- add support for reading it from metadata;
- missing invoiceId => typed verification failure/review path, never guessed.

PLATFORM_SUBSCRIPTION does not require booking refs.

Populate the coordinator-approved optional fields on `VerifiedPaymentEvent`.

### INT2-W2-T2 — Sandbox checkout metadata for balance
Extend the existing Stripe-style checkout builders/types minimally so a BALANCE checkout can carry authoritative `invoiceId` metadata.

Do not invent invoice amount client-side:
- amount still comes from accepted server input;
- keep idempotency;
- keep quote/hold scope rules where existing V1 flow requires them.

Maintain test-mode/demo behavior only.

### INT2-W2-T3 — Core payment application bridge
Add suggested:
- `src/server/integrations/payments/core-application-bridge.ts`

Define an injected Core port matching:
`applyVerifiedPayment(event): Promise<Result<VerifiedPaymentApplicationOutcome>>`

Expose a `PaymentWebhookApplicationStore` adapter for `handleStripePaymentWebhook`.

Map:
- Core APPLIED -> provider handler APPLIED
- Core DUPLICATE -> DUPLICATE
- Core PAYMENT_REVIEW -> PAYMENT_REVIEW

Core Result failure must throw/return a retryable handler failure as appropriate; do not acknowledge a verified callback whose durable Core application failed.

Do not add OUT_OF_ORDER as a fake Core outcome. Existing connector-side ordering logic may still classify provider callback order before/around the bridge.

### INT2-W2-T4 — Review classifier uses preserved refs
Extend payment review/classification tests so quote/hold/invoice references survive normalization but are not exposed as raw sensitive provider payload.

Late hold, amount, currency, workspace, purpose mismatches remain review-only and cannot mutate business truth in Connector code.

### INT2-W2-T5 — Provider handler integration
Add a focused composition/helper around `provider-stripe.ts` that uses:
- existing PaymentAdapter verification;
- the new Core application bridge;
- existing review routing where Core returns PAYMENT_REVIEW.

Required behavior:
- invalid signature => no Core call;
- verified + APPLIED => 200 ACK;
- verified + DUPLICATE => 200 ACK;
- verified + PAYMENT_REVIEW => durable review route then 200 ACK only if review persistence succeeds;
- Core/review persistence failure => 503, acknowledged false, retryable true.

No live Stripe network call is required.

### INT2-W2-T6 — Sandbox evidence policy
Update payment evidence/tests so all Stripe V1 evidence remains explicitly SANDBOX/CONTRACT_TESTED.
Never promote to live PROVIDER_VERIFIED.

Use official Stripe-style test IDs/event shapes in fixtures.

### INT2-W2-T7 — Combined outage harness
Add:
`tests/providers/runtime-outage-payment-core-bridge-harness.ts`

Execute:
- signed sandbox DEPOSIT webhook with quoteId/holdId;
- signed BALANCE webhook with invoiceId;
- missing refs rejected;
- Core APPLIED/DUPLICATE/REVIEW mappings;
- Core failure => retryable 503;
- review persistence failure => retryable 503;
- no live key/account required.

### INT2-W2-T8 — Canonical tests
Author focused provider tests for all above.
If pnpm recovers, run payment/provider/AI/typecheck.

## Continue rule
Do not add new provider families. Complete all independent payment bridge work before returning.

## Receipt
`docs/execution/receipts/v1-int2-worker-2.md`

Return:
WORKER=2
SPRINT=V1-INT2
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E04 committed outbox worker connector adapter
