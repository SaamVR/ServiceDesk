# Worker 2 V1-INT4 Receipt — WhatsApp Inbox / Core Handoff

Repository: `SaamVR/ServiceDesk`  
Original branch: `feat/servicedesk-v1-connectors-sprint4`  
Continued branch: `feat/servicedesk-v1-connectors-sprint5`  
Original coordinator ref: `9ce12193caf3d2104168931b28efeeaf22a9d531`  
INT4B coordinator ref: `184331936ba6c81a1d216c7d866d8b62bd2c5b10`

## INT4 state

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`

INT4 delivered the connector side of E05:

- Durable WhatsApp provider receipt store adapter.
- Core inbound message handoff using frozen `applyInboundMessage(event)` shape.
- Durable webhook ordering: signature verify → parse → provider receipt persist → Core process → ACK.
- Provider receipt duplicate still reaches Core.
- Core `APPLIED` maps to processor `PROCESSED`; Core `DUPLICATE` maps to processor `DUPLICATE`.
- Core failure remains retryable webhook failure.
- Connector-owned `CUSTOMER_REPLY` delivery purpose.
- Authoritative `conversation.reply` intent resolver.
- WhatsApp and Email staff reply behavior.
- Opt-out/hard-bounce suppression retained.
- Human handover does not suppress explicitly authorized staff reply.
- WhatsApp delivery-state bridge prepared without mutating Core.

INT4 outage harness result:

```text
runtime-outage-e05-whatsapp-core-handoff-harness PASS
```

## INT4B addendum — Provider persistence reconciliation

Continuation start SHA: `8f78bb25bccb72c48e23ab99c17ebf454ff3b5a7`  
Accepted code HEAD before Sprint 5: `c5e201759eb804c530c8589f805fb8a800222464`

INT4B reconciliation status:

- `TIMESTAMP_BRIDGE=PASS`
- `RECEIPT_SCHEMA_ALIGNMENT=PASS`
- `STAGING_RECEIPT_PROOF=BLOCKED_ON_CORE_0008`

INT4B delivered:

- Added canonical WhatsApp timestamp normalization helper.
- Converted valid Unix seconds and Unix milliseconds to ISO timestamps.
- Preserved valid ISO input as normalized ISO.
- Invalid provider timestamp fails closed before Core call.
- Core `InboundMessageEvent.occurredAt` now receives valid ISO only.
- Minimized provider receipt row to technical fields only:
  - `receiptKey`
  - `workspaceId`
  - `provider`
  - `providerAccountId`
  - `providerMessageId`
  - `senderRef`
  - `providerOccurredAt`
  - `rawProviderEventRef`
  - `contentKind`
- Removed duplicated text body/media fields from technical receipt persistence shape.
- Added dependency-injected Supabase receipt gateway compatible with the corrected `provider_inbound_receipts` contract.
- Preserved deterministic `INSERTED` / `DUPLICATE` behavior.
- Preserved retry-after-Core-failure semantics:
  - first callback inserts receipt;
  - Core failure returns retryable 503;
  - provider retry sees receipt duplicate and still calls Core;
  - later Core duplicate ACKs safely.
- Preserved `CUSTOMER_REPLY` contract and delivery-state bridge preparation.

Staging check:

```text
project=cpmmgivhlkfbiwzhlcey
public.provider_inbound_receipts not present at time of check
STAGING_RECEIPT_PROOF=BLOCKED_ON_CORE_0008
```

INT4B outage harness result:

```text
runtime-outage-e05-whatsapp-core-handoff-harness PASS
```

## Canonical gate

Canonical pnpm/Vitest/typecheck remains blocked by Runtime package/Git DNS outage until normal tooling returns.

Required catch-up:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/e05-whatsapp-timestamp-normalization.test.ts tests/providers/e05-whatsapp-provider-receipt-store.test.ts tests/providers/e05-whatsapp-core-handoff.test.ts tests/providers/e05-conversation-reply-intent.test.ts tests/providers/e05-whatsapp-delivery-state-bridge.test.ts
pnpm vitest run tests/providers
pnpm typecheck
```

## Proof labels

- Outage-mode changed behavior: `IMPLEMENTED`
- Canonical Vitest/typecheck: `CONFIGURATION_BLOCKED`
- Provider verification: not claimed
- Contract-tested label: not claimed

## Next task

`E06 calendar/crew transition connector bridge`
