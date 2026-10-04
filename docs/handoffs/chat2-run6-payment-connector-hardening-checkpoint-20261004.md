# ServiceDesk Connector Run 6 — Payment Connector Hardening

Branch: `feat/servicedesk-v1-connectors`

Start HEAD: `eb3e5397830fbb267d950929f2112b72a415a34d`
Checkpoint pre-doc HEAD: `6791edd3d272587fe38b7f40d0f6488502320ecd`

## Completed

- Hardened Stripe checkout transport validation:
  - expired hold rejection;
  - unsupported purpose rejection;
  - platform subscription total amount handling;
  - no provider transport call before local guard pass.
- Hardened Stripe fixture checkout validation to match transport behavior.
- Hardened verified webhook payload validation:
  - account mismatch;
  - missing workspace metadata;
  - invalid purpose;
  - invalid amount;
  - invalid currency shape;
  - missing transaction reference;
  - ignored failed payment event.
- Added payment application state decisions:
  - first apply;
  - duplicate acknowledgement;
  - out-of-order ignored;
  - mismatch to payment review.
- Added payment review bridge:
  - enqueue ambiguous verified callbacks to review;
  - redact transaction reference;
  - no business-truth mutation authority;
  - typed retryable enqueue failure.
- Preserved concurrent connector commits:
  - payment proof/recovery additions;
  - email export additions.

## Added/changed files

- `tests/providers/payment-checkout-hardening.test.ts`
- `src/server/integrations/payments/stripe-checkout.ts`
- `tests/providers/payment-webhook-validation.test.ts`
- `src/server/integrations/payments/adapter.ts`
- `tests/providers/payment-application-state.test.ts`
- `src/server/integrations/payments/application-state.ts`
- `tests/providers/payment-review-bridge.test.ts`
- `src/server/integrations/payments/review-bridge.ts`
- `src/server/integrations/index.ts`

## Tests

Not run in this cycle.

Runtime blocker remains:

`CONNECTOR_TEST_ENV_BLOCKED_ENOSPC`

Known state from prior runs:

- `samai`: Node/pnpm available but disk full; previous fetch/install failed with `No space left on device`.
- `samvr`: node/pnpm unavailable and disk low.

## Provider proof

No Stripe sandbox/live provider proof claimed.

Proof level remains:

`IMPLEMENTED / CONTRACT_TESTED`

## Next READY

Run 7 — Provider Recovery Engine.

Recommended first tasks:

1. Retry-budget and backoff tests across provider recovery.
2. Provider-specific recovery classification for WhatsApp, Calendar, Payment, Email, Webhook.
3. Queue serialization for retry / reconciliation / operator review / dead letter.
4. Restart-safe recovery record validation and secret/PII redaction.
