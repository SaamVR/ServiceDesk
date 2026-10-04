# Worker 2 V1-INT3 Receipt — Outbox Connector Executor

Repository: `SaamVR/ServiceDesk`  
Branch: `feat/servicedesk-v1-connectors-sprint3`  
Coordinator ref: `57c7d53a7aee7cf13ae7563807e71d5066816556`  
Required sprint base: `b744bbba9c02904a5981e09c8d064face0de4a90`  
Implementation SHA before receipt: `cca03ab8289f6c51b01a4893ccf475396b961742`

## State

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`

Completed slices:
- `INT3-W2-T1` — authoritative delivery-intent resolver port.
- `INT3-W2-T2` — shared `OutboxExecutionPort` adapter.
- `INT3-W2-T3` — WhatsApp dispatcher adapter.
- `INT3-W2-T4` — Email dispatcher adapter.
- `INT3-W2-T5` — Webhook dispatcher adapter.
- `INT3-W2-T6` — redaction and identity regressions.
- `INT3-W2-T7` — combined package-free outage harness.
- `INT3-W2-T8` — canonical provider tests authored.

## Runtime probe

One normal Runtime recovery probe was performed in GPT Runtime Machine only.

Observed:

```text
pwd=/
node --version -> v22.16.0
npm --version -> 10.9.2
corepack --version -> 0.32.0
pnpm --version -> bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors-sprint3 -> fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
corepack prepare pnpm@10.17.1 --activate -> Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz
```

Canonical pnpm/Vitest/typecheck path remains unavailable, so this sprint used Runtime Outage Mode.

## Delivered behavior

### Delivery intent boundary

Added:
- `src/server/integrations/outbox/intent-resolver.ts`

The connector now accepts an injected `OutboxDeliveryIntentResolver`:

```ts
resolve(ClaimedOutboxEvent): Promise<Result<OutboxJob>>
```

The connector does not query Core repositories directly.

Resolved job validation now fails closed before provider dispatch when:
- `job.id` does not match claimed event id;
- workspace does not match;
- idempotency key does not match;
- channel is missing;
- purpose is missing;
- recipient reference is blank.

### Shared execution adapter

Added:
- `src/server/integrations/outbox/execution-adapter.ts`

The adapter implements the frozen `OutboxExecutionPort` contract without modifying `src/contracts/outbox.ts`.

Mapping:
- committed `ACCEPTED` -> Core `SENT` with `providerReference`;
- `RETRYABLE_FAILURE` -> `RETRYABLE_FAILURE`;
- `TERMINAL_FAILURE` -> `TERMINAL_FAILURE`;
- `SUPPRESSED` -> `SUPPRESSED`.

`providerReference` is returned only after provider acceptance.

### Channel dispatchers

Added:
- `src/server/integrations/outbox/whatsapp-dispatcher.ts`
- `src/server/integrations/outbox/email-dispatcher.ts`
- `src/server/integrations/outbox/webhook-dispatcher.ts`

WhatsApp adapts the existing `MessagingAdapter` to `CommittedOutboxDispatcher`.
Email adapts `TransactionalEmailAdapter` from resolver-produced normalized payload fields: `to`, `subject`, `text`, `html`, and optional policy.
Webhook uses injected server-resolved endpoint/envelope plus injected transport; endpoint/secret/config is not trusted from the claimed outbox event payload.

Connector does not implement retry persistence or retry loops; Core E04 owns retry claim/lease/persistence.

### Redaction hardening

Updated:
- `src/server/integrations/outbox/failure-policy.ts`

Regression coverage proves connector failure outcomes do not expose:
- bearer/access tokens;
- raw email body/html;
- raw webhook response;
- recipient email/phone PII;
- raw provider events.

## Changed files

- `src/server/integrations/outbox/intent-resolver.ts`
- `src/server/integrations/outbox/execution-adapter.ts`
- `src/server/integrations/outbox/whatsapp-dispatcher.ts`
- `src/server/integrations/outbox/email-dispatcher.ts`
- `src/server/integrations/outbox/webhook-dispatcher.ts`
- `src/server/integrations/outbox/failure-policy.ts`
- `tests/providers/runtime-outage-outbox-execution-adapter-harness.ts`
- `tests/providers/outbox-intent-resolver.test.ts`
- `tests/providers/outbox-execution-adapter.test.ts`
- `tests/providers/outbox-channel-dispatchers.test.ts`

Not touched:
- `src/contracts/outbox.ts`
- Core repositories / jobs implementation
- Product/UI
- package / lockfile
- shared barrels
- provider families outside E04 outbox execution

## Outage harness proof

Materialized the exact changed connector source subset under `/mnt/data/servicedesk-int3` and executed with global `ts-node` + Node assert:

```bash
cd /mnt/data/servicedesk-int3 && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-outbox-execution-adapter-harness.ts
```

Result:

```text
runtime-outage-outbox-execution-adapter-harness PASS
```

Harness coverage:
- WHATSAPP success -> `SENT` with providerReference;
- EMAIL success -> `SENT` with providerReference;
- WEBHOOK success -> `SENT` with providerReference;
- WhatsApp retryable provider failure -> `RETRYABLE_FAILURE`;
- WhatsApp terminal provider failure -> `TERMINAL_FAILURE`;
- Email suppression -> `SUPPRESSED`;
- Webhook 503 -> `RETRYABLE_FAILURE` with retryAfterSeconds;
- Webhook 403 -> `TERMINAL_FAILURE`;
- resolver workspace mismatch returns terminal failure before provider call;
- unresolved intent returns terminal failure before provider call;
- idempotency key preserved through provider mapping;
- token/phone/email/html raw content redacted from Core-facing result.

## Canonical tests authored but not executed

Authored focused canonical provider tests:

```bash
pnpm vitest run tests/providers/outbox-intent-resolver.test.ts tests/providers/outbox-execution-adapter.test.ts tests/providers/outbox-channel-dispatchers.test.ts
```

Required catch-up when Runtime package/network access returns:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/outbox-intent-resolver.test.ts tests/providers/outbox-execution-adapter.test.ts tests/providers/outbox-channel-dispatchers.test.ts
pnpm vitest run tests/providers
pnpm typecheck
```

## Proof labels

- Outage-mode changed behavior: `IMPLEMENTED`
- Canonical Vitest/typecheck: `CONFIGURATION_BLOCKED`
- Provider verification: not claimed
- Contract-tested label: not claimed

## Blockers

- `BLOCKED_RUNTIME_GIT_DNS`: normal Runtime Git transport cannot resolve `github.com`.
- `BLOCKED_RUNTIME_PACKAGE_ACCESS`: Corepack cannot fetch pnpm; `pnpm` is unavailable.
- `CANONICAL_GATE=CONFIGURATION_BLOCKED`: canonical provider suite/typecheck not run.

## Ready next

`E05 WhatsApp/inbox Core handoff integration`
