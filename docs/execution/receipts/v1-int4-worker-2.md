# Worker 2 V1-INT4 Receipt — WhatsApp Inbox / Core Handoff

Repository: `SaamVR/ServiceDesk`  
Branch: `feat/servicedesk-v1-connectors-sprint4`  
Coordinator ref: `9ce12193caf3d2104168931b28efeeaf22a9d531`  
Start SHA: `602e581c1df860480c230da893128c0d1b8ca395`  
Implementation SHA before receipt: `68b818f88ac38faccfd3b1764d0f6caf8e765f9b`

## State

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`

## Runtime recovery probe

Single normal Runtime probe was performed in GPT Runtime Machine only.

Observed:

```text
pwd=/
node --version -> v22.16.0
npm --version -> 10.9.2
corepack --version -> 0.32.0
pnpm --version -> bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors-sprint4 -> fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
corepack prepare pnpm@10.17.1 --activate -> Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz
```

Normal pnpm/Vitest/typecheck path remains unavailable, so this sprint used Runtime Outage Mode.

## Completed slices

- `INT4-W2-T1` — Durable WhatsApp provider receipt store adapter.
- `INT4-W2-T2` — Core inbound command bridge using frozen `InboundMessageEvent` / `InboundMessageApplicationOutcome`.
- `INT4-W2-T3` — Durable inbound webhook composition preserved existing verify → parse → persist → process → ACK flow, including duplicate persistence still reaching Core.
- `INT4-W2-T4` — Added connector-owned `CUSTOMER_REPLY` delivery purpose.
- `INT4-W2-T5` — Authoritative conversation-reply intent resolver for `conversation.reply`.
- `INT4-W2-T6` — WhatsApp and Email staff reply behavior wired through existing dispatchers; handover does not suppress authorized staff replies.
- `INT4-W2-T7` — WhatsApp delivery-state bridge prepared Core-facing delivery update commands while preserving monotonic/terminal FAILED rules.
- `INT4-W2-T8` — Package-free outage harness plus canonical provider tests authored.

## Changed files

- `src/server/integrations/types.ts`
- `src/server/integrations/email/adapter.ts`
- `src/server/integrations/outbox/email-dispatcher.ts`
- `src/server/integrations/outbox/failure-policy.ts`
- `src/server/integrations/whatsapp/provider-receipt-store.ts`
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`
- `src/server/integrations/outbox/conversation-reply-intent.ts`
- `src/server/integrations/whatsapp/delivery-state-bridge.ts`
- `tests/providers/runtime-outage-e05-whatsapp-core-handoff-harness.ts`
- `tests/providers/e05-whatsapp-provider-receipt-store.test.ts`
- `tests/providers/e05-whatsapp-core-handoff.test.ts`
- `tests/providers/e05-conversation-reply-intent.test.ts`
- `tests/providers/e05-whatsapp-delivery-state-bridge.test.ts`

No Core repositories, Product/UI, shared E05 contracts, package files, lockfiles, retry persistence, new provider family, or live provider configuration were touched.

## Behavior delivered

### Durable WhatsApp provider receipts

- `createWhatsAppProviderReceiptStore(...)` adapts `DurableWhatsAppInboxStore` to an injected trusted-server receipt gateway.
- Receipt rows preserve `receiptKey`, `workspaceId`, provider/account/message/sender/timestamp, normalized text/media refs, and `rawProviderEventRef`.
- Receipt rows do not persist raw provider body, secrets, AI authority, or provider token material.
- Duplicate behavior remains deterministic through injected `insertReceipt(...) -> INSERTED | DUPLICATE`.
- Wrong provider/channel/identity fails closed before persistence.

### Core inbound handoff

- `createWhatsAppInboundCoreHandoffProcessor(...)` now supports frozen Core `applyInboundMessage(event)` while preserving the prior command-port compatibility shape.
- Durable records map to Core `InboundMessageEvent` with:
  - `receiptKey`
  - `workspaceId`
  - `providerAccountId`
  - `providerMessageId`
  - `senderRef`
  - `providerTimestamp -> occurredAt`
  - `TEXT / MEDIA_REFERENCE / UNSUPPORTED`
  - `media` reference only, no media body
  - `rawProviderEventRef`
- Core `APPLIED` maps to processor `PROCESSED`.
- Core `DUPLICATE` maps to processor `DUPLICATE`.
- Core failure throws so the durable webhook path returns retryable 503 and preserves retry identity.

### Conversation reply intent

- Added `resolveConversationReplyIntent(...)` and `buildConversationReplyOutboxJob(...)`.
- Only topic `conversation.reply` is accepted.
- Claimed payload IDs must match authoritative source IDs.
- Only `STAFF` sender kind is allowed for this E05 provider handoff.
- Only `WHATSAPP` and `EMAIL` channels are allowed.
- Arbitrary recipient/body/provider config from outbox payload is not trusted; source port supplies authoritative body/contact/policy.
- Produced `OutboxJob` uses purpose `CUSTOMER_REPLY` and preserves idempotency.
- Human handover is preserved as state but does not suppress explicit staff customer replies.

### Channel behavior

- WhatsApp staff reply uses existing `MessagingAdapter` path and treats provider acceptance as acceptance only, not delivery proof.
- Email staff reply uses normalized authoritative `subject/text/html` and purpose `CUSTOMER_REPLY`.
- Email/recipient suppression still honors opt-out and hard bounce.
- Handover alone does not suppress explicitly authorized staff replies.

### Delivery-state bridge

- Added `buildWhatsAppDeliveryStateUpdate(...)` to translate existing WhatsApp status transition decisions into a Core-facing message delivery update command shape.
- Maps `PROVIDER_ACCEPTED`, `DELIVERED`, `READ`, and `FAILED`.
- Does not emit Core update commands for duplicate/stale transitions.
- Preserves prior monotonic rules and terminal `FAILED` behavior.

## Outage harness proof

Materialized the exact changed behavior under `/mnt/data/servicedesk-int4` and executed:

```bash
cd /mnt/data/servicedesk-int4 && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-e05-whatsapp-core-handoff-harness.ts
```

Result:

```text
runtime-outage-e05-whatsapp-core-handoff-harness PASS
```

Harness coverage:

- receipt `INSERTED` + Core `APPLIED`;
- receipt `DUPLICATE` + Core `APPLIED` after previous Core failure;
- later receipt `DUPLICATE` + Core `DUPLICATE`;
- Core failure returns retryable 503;
- invalid signature calls neither receipt persistence nor Core;
- conversation reply intent rejects identity mismatch;
- `CUSTOMER_REPLY` WhatsApp success;
- `CUSTOMER_REPLY` Email success;
- opt-out suppression;
- human handover does not suppress authorized staff reply;
- delivery-state helper emits only monotonic updates and preserves terminal failed semantics;
- no raw provider body or app secret leaked into Core-facing/provider-facing results.

## Canonical tests authored but not executed

- `tests/providers/e05-whatsapp-provider-receipt-store.test.ts`
- `tests/providers/e05-whatsapp-core-handoff.test.ts`
- `tests/providers/e05-conversation-reply-intent.test.ts`
- `tests/providers/e05-whatsapp-delivery-state-bridge.test.ts`

Required catch-up when Runtime package/network access returns:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/e05-whatsapp-provider-receipt-store.test.ts tests/providers/e05-whatsapp-core-handoff.test.ts tests/providers/e05-conversation-reply-intent.test.ts tests/providers/e05-whatsapp-delivery-state-bridge.test.ts
pnpm vitest run tests/providers
pnpm vitest run tests/ai
pnpm typecheck
```

## Proof labels

- Outage-mode changed behavior: `IMPLEMENTED`
- Canonical Vitest/typecheck: `CONFIGURATION_BLOCKED`
- Provider verification: not claimed
- Contract-tested label: not claimed

## Next task

`E06 calendar/crew transition connector bridge`
