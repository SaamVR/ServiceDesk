# Worker 2 Receipt — V1-INT1 Provider/Core Bridge

Repository: `SaamVR/ServiceDesk`  
Branch: `feat/servicedesk-v1-connectors-sprint1`  
Coordinator ref: `65f4ed196acc481d1c7657ae48f80ed57e74d8ae`  
Required sprint base: `714f24edfe7c6124237c7259a00ede7b288b68fb`

## State

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`

## Branch verification

Initial remote branch HEAD was exactly the required sprint base:

```text
feat/servicedesk-v1-connectors-sprint1 -> 714f24edfe7c6124237c7259a00ede7b288b68fb
```

No newer sprint work was present before this run.

## Runtime probe

One quick normal GPT Runtime recovery probe was performed. Results:

```text
pwd -> /
node --version -> v22.16.0
npm --version -> 10.9.2
corepack --version -> 0.32.0
pnpm --version -> bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors-sprint1 -> fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
corepack prepare pnpm@10.17.1 --activate -> Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz
```

Normal canonical tooling remains unavailable, so this sprint used Runtime Outage Mode.

## Completed slices

COMPLETED:
- `INT1-W2-T1`
- `INT1-W2-T2`
- `INT1-W2-T3`
- `INT1-W2-T4`
- `INT1-W2-T5`
- `INT1-W2-T6`
- `INT1-W2-T7`

## Delivered

### INT1-W2-T1 — RC connector compatibility harness

Added:
- `tests/providers/runtime-outage-integration-compatibility-harness.ts`

Behavior:
- scans local relative imports in Connector/AI-owned paths;
- asserts each local import target exists;
- asserts connector-owned modules do not import Product/UI paths.

Outage execution was run against the materialized package-free bridge subset because GPT Runtime Git checkout is blocked.

Result:

```text
runtime-outage-integration-compatibility-harness PASS files=10
```

### INT1-W2-T2 — Provider-neutral committed-outbox dispatch boundary

Added:
- `src/server/integrations/outbox/dispatch-port.ts`

Delivered:
- Core-callable injected dispatch boundary;
- preserves job id, workspace, channel, purpose, and idempotency key;
- outcomes: `ACCEPTED`, `RETRYABLE_FAILURE`, `TERMINAL_FAILURE`, `SUPPRESSED`;
- redacted provider evidence/message identity supported;
- no business-truth mutation.

### INT1-W2-T3 — Dispatch router

Added:
- `src/server/integrations/outbox/dispatch-router.ts`

Delivered:
- routes `WHATSAPP`, `EMAIL`, and `WEBHOOK` by injected dispatchers;
- re-checks recipient suppression/handover guard before sending;
- rejects workspace mismatch;
- unsupported/missing channel dispatcher fails closed;
- no direct Core repository access.

### INT1-W2-T4 — Retry/failure classification bridge

Added:
- `src/server/integrations/outbox/failure-policy.ts`

Delivered classification:
- timeout/network/rate-limit/transient errors -> `RETRYABLE_FAILURE`;
- configuration/auth/invalid request errors -> `TERMINAL_FAILURE`;
- suppression/handover/opt-out errors -> `SUPPRESSED`;
- unknown provider errors fail closed as `TERMINAL_FAILURE`;
- no raw provider body or secret is emitted by the policy.

### INT1-W2-T5 — Payment/Core event compatibility

Added:
- `src/server/integrations/payments/verified-payment-compatibility.ts`
- `tests/providers/payment-verified-event-compatibility.test.ts`

Delivered:
- compile/static type parity helper proving `VerifiedPaymentWebhook["event"]` is the existing Core `VerifiedPaymentEvent` shape;
- `verifiedPaymentEventForCore(webhook)` returns the Core event without remapping or field loss;
- explicitly records remaining E03 dependency.

Remaining E03 dependency:

```text
Core E03 must expose authoritative applied/duplicate/review outcome semantics after applyVerifiedPayment(event).
```

No Core payment application outcome semantics were invented.

### INT1-W2-T6 — WhatsApp inbound -> Core business-command handoff

Added:
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`
- `tests/providers/whatsapp-inbound-core-handoff.test.ts`

Delivered:
- injected business-command port;
- preserves `receiptKey` as idempotency identity;
- preserves normalized text/media/unsupported semantics;
- maps duplicate business command result to processor `DUPLICATE`;
- command failure throws through the existing durable inbound processor path so provider handler can remain retryable;
- no direct Core repository mutation.

### INT1-W2-T7 — Combined outage harness + canonical tests

Added:
- `tests/providers/runtime-outage-provider-core-bridge-harness.ts`
- `tests/providers/outbox-dispatch-router.test.ts`
- `tests/providers/outbox-failure-policy.test.ts`
- `tests/providers/payment-verified-event-compatibility.test.ts`
- `tests/providers/whatsapp-inbound-core-handoff.test.ts`

Package-free harness executed in GPT Runtime:

```bash
cd /mnt/data/sd-v1-int1 && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-provider-core-bridge-harness.ts
```

Result:

```text
runtime-outage-provider-core-bridge-harness PASS
```

Compatibility harness executed against the materialized bridge subset:

```bash
cd /mnt/data/sd-v1-int1 && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-integration-compatibility-harness.ts /mnt/data/sd-v1-int1
```

Result:

```text
runtime-outage-integration-compatibility-harness PASS files=10
```

## Changed files

- `src/server/integrations/outbox/dispatch-port.ts`
- `src/server/integrations/outbox/dispatch-router.ts`
- `src/server/integrations/outbox/failure-policy.ts`
- `src/server/integrations/payments/verified-payment-compatibility.ts`
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`
- `tests/providers/runtime-outage-integration-compatibility-harness.ts`
- `tests/providers/runtime-outage-provider-core-bridge-harness.ts`
- `tests/providers/outbox-dispatch-router.test.ts`
- `tests/providers/outbox-failure-policy.test.ts`
- `tests/providers/payment-verified-event-compatibility.test.ts`
- `tests/providers/whatsapp-inbound-core-handoff.test.ts`

## Ownership / restrictions

Did not touch:
- Core implementation;
- Product/UI;
- shared contracts;
- package files / lockfile;
- coordinator-owned shared barrels;
- provider credentials;
- GitHub Actions;
- local devices, samvr, samai, SSH, or self-hosted runners.

The GitHub contents API created one commit per file because normal Git transport is blocked; all commits are linear on the sprint branch and ownership-clean.

## Canonical tests authored but not run

Canonical Vitest/typecheck remains blocked by Runtime DNS/package access.

Catch-up gate when Runtime recovers:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/outbox-dispatch-router.test.ts tests/providers/outbox-failure-policy.test.ts tests/providers/payment-verified-event-compatibility.test.ts tests/providers/whatsapp-inbound-core-handoff.test.ts
pnpm vitest run tests/providers
pnpm vitest run tests/ai
pnpm typecheck
```

## Proof labels

- Outage-mode bridge behavior: `IMPLEMENTED`
- Canonical Vitest/typecheck: `CONFIGURATION_BLOCKED`
- Contract-tested label: not claimed
- Provider-verified label: not claimed

## Blockers

BLOCKERS:
- `BLOCKED_RUNTIME_GIT_DNS`: `github.com` cannot be resolved by normal Runtime Git transport.
- `BLOCKED_RUNTIME_PACKAGE_ACCESS`: Corepack cannot fetch `pnpm@10.17.1` from `registry.npmjs.org`; `pnpm` unavailable.
- `E03_CORE_PAYMENT_OUTCOME_CONTRACT`: Core must expose authoritative applied/duplicate/review outcome semantics before the payment bridge can map provider verification into Core application outcome.

## Ready next

READY_NEXT: `E03 payment bridge after Core authoritative outcome contract`
