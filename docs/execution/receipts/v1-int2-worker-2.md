# Worker 2 V1-INT2 Receipt — Stripe Sandbox / Core Payment Bridge

Repository: `SaamVR/ServiceDesk`  
Branch: `feat/servicedesk-v1-connectors-sprint2`  
Coordinator ref: `bc9f69f8735a8c3ddf637e26653e44090bb58d53`  
Start SHA: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

## State

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`

## Runtime probe

One normal GPT Runtime recovery probe was performed before outage work.

Observed:

```text
pwd=/
node --version -> v22.16.0
npm --version -> 10.9.2
corepack --version -> 0.32.0
pnpm --version -> bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors-sprint2 -> fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
corepack prepare pnpm@10.17.1 --activate -> Internal Error: Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz
```

Normal pnpm/Vitest/typecheck path remains unavailable. Work proceeded under Runtime Outage Mode using package-free TypeScript and Node assert.

## Completed slices

- `INT2-W2-T1` — preserved authoritative `quoteId`, `holdId`, and `invoiceId` through Stripe-style sandbox webhook normalization.
- `INT2-W2-T2` — extended sandbox checkout metadata so BALANCE carries `invoiceId` without inventing amount client-side.
- `INT2-W2-T3` — added Core payment application bridge mapping only `APPLIED`, `DUPLICATE`, and `PAYMENT_REVIEW`.
- `INT2-W2-T4` — retained quote/hold/invoice references in payment review classification without raw provider payload exposure.
- `INT2-W2-T5` — updated Stripe provider webhook handler to verify webhook, call injected Core bridge, route `PAYMENT_REVIEW`, and return retryable 503 on Core/review persistence failure.
- `INT2-W2-T6` — kept Stripe V1 evidence SANDBOX / CONTRACT_TESTED only; no live provider verification claim.
- `INT2-W2-T7` — added and executed combined package-free outage harness.
- `INT2-W2-T8` — authored canonical provider regression tests for catch-up once pnpm/Vitest is available.

## Changed files

- `src/server/integrations/types.ts`
- `src/server/integrations/payments/adapter.ts`
- `src/server/integrations/payments/stripe-checkout.ts`
- `src/server/integrations/payments/core-application-bridge.ts`
- `src/server/integrations/payments/review.ts`
- `src/server/api-handlers/provider-stripe.ts`
- `tests/providers/runtime-outage-payment-core-bridge-harness.ts`
- `tests/providers/payment-core-bridge.test.ts`
- `tests/providers/payment-sandbox-reference-normalization.test.ts`

No new provider family was added. No WhatsApp/Calendar/Email/n8n broadening was performed. No Core repositories, Product/UI, shared contracts, package/lockfile, live credentials, local devices, self-hosted runners, or GitHub Actions were used.

## Outage harness proof

Materialized the changed payment/Core bridge subset in GPT Runtime scratch space and executed:

```bash
cd /mnt/data/sd-int2 && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-payment-core-bridge-harness.ts
```

Result:

```text
runtime-outage-payment-core-bridge-harness PASS
```

Harness covered:

- signed sandbox DEPOSIT webhook preserves `quoteId` and `holdId`;
- signed sandbox BALANCE webhook preserves `invoiceId`;
- DEPOSIT missing `quoteId`/`holdId` is rejected before Core;
- BALANCE missing `invoiceId` is rejected before Core;
- fixture checkout and Stripe-style injected checkout carry `invoiceId` metadata;
- Core `APPLIED` maps to handler `APPLIED` and ACK;
- Core `DUPLICATE` maps to handler `DUPLICATE` and ACK;
- Core `PAYMENT_REVIEW` durably routes review before ACK;
- invalid signature never calls Core;
- Core persistence failure returns 503 / `acknowledged=false` / `retryable=true`;
- review persistence failure returns 503 / `acknowledged=false` / `retryable=true`;
- review item preserves authoritative refs while redacting provider transaction reference;
- evidence remains `SANDBOX` / `CONTRACT_TESTED` only.

## Canonical tests authored but not executed

- `tests/providers/payment-core-bridge.test.ts`
- `tests/providers/payment-sandbox-reference-normalization.test.ts`

Required catch-up when Runtime package/network access returns:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/payment-core-bridge.test.ts tests/providers/payment-sandbox-reference-normalization.test.ts
pnpm vitest run tests/providers
pnpm vitest run tests/ai
pnpm typecheck
```

## Provider evidence policy

Stripe V1 evidence remains SANDBOX / DEMO only. This receipt does not claim `PROVIDER_VERIFIED`.

## Blockers

- `BLOCKED_RUNTIME_GIT_DNS`
- `BLOCKED_RUNTIME_PACKAGE_ACCESS`
- `CANONICAL_GATE=CONFIGURATION_BLOCKED` until pnpm/Vitest/typecheck can run.

## Ready next

`E04 committed outbox worker connector adapter`
