# V1 Integration Sprint 4 — Worker 2 / WhatsApp Inbox + Reply Bridge

Branch: `feat/servicedesk-v1-connectors-sprint4`
Exact base: `602e581c1df860480c230da893128c0d1b8ca395`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

Use the coordinator-frozen E05 types from:
- `src/contracts/dtos.ts`
- `src/server/core/facade.ts`

Do not mutate Core repositories or shared contracts.

## Mission
Close the Connector side of E05: durable WhatsApp provider receipt persistence, Core inbound handoff, and provider-neutral outbound customer-reply intent.

One normal Runtime recovery probe only. Continue under outage mode if canonical tooling remains unavailable.

## INT4-W2-T1 — Durable provider receipt store adapter

Current abstractions:
- `src/server/integrations/whatsapp/inbox-persistence.ts`
- `DurableWhatsAppInboxStore`

Add a trusted-server persistence adapter against the E05 `provider_inbound_receipts` schema through an injected table/RPC gateway.

Required:
- receiptKey unique;
- INSERTED vs DUPLICATE deterministic;
- wrong workspace/provider identity fails closed;
- raw provider BODY is never persisted, only rawProviderEventRef;
- no provider secret/token material.

Do not access business conversation/message repositories.

## INT4-W2-T2 — Core inbound command bridge

Refactor/extend:
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`

Use an injected Core port matching:
`applyInboundMessage(event): Promise<Result<InboundMessageApplicationOutcome>>`

Map durable WhatsApp record -> coordinator-frozen `InboundMessageEvent`.

Preserve:
- receiptKey
- workspaceId
- providerAccountId
- providerMessageId
- senderRef
- providerTimestamp -> occurredAt
- TEXT / MEDIA_REFERENCE
- rawProviderEventRef

Core APPLIED => processor PROCESSED.
Core DUPLICATE => processor DUPLICATE.
Core failure => throw/retryable handler failure preserving receipt identity.

Unsupported records remain explicitly skipped by the existing processor, not invented as business messages.

## INT4-W2-T3 — Durable inbound webhook composition

Keep order:
signature verify -> parse -> durable provider receipt persist -> Core process -> ACK.

Important retry semantics:
- provider receipt DUPLICATE must STILL reach Core processor;
- if Core failed after receipt persistence, provider retry must re-attempt Core;
- successful Core duplicate later ACKs safely;
- persistence/Core failures => 503, acknowledged false, retryable true;
- invalid signature/malformed payload never calls persistence/Core.

No direct AI/business mutation in Connector.

## INT4-W2-T4 — Customer reply delivery purpose

Extend Connector-owned delivery types with `CUSTOMER_REPLY`.

Update WhatsApp and Email dispatch mappings only as required.

For EMAIL, add a truthful transactional purpose for a human customer reply rather than mapping it to QUOTE/BOOKING/RECEIPT.

Do not broaden other provider families.

## INT4-W2-T5 — Authoritative conversation-reply intent resolver

Add suggested:
- `src/server/integrations/outbox/conversation-reply-intent.ts`

Input is the frozen claimed outbox event with topic `conversation.reply`.

Use an injected authoritative source port to load:
- conversation/message identity;
- senderKind;
- channel;
- recipient policy/contact;
- conversation version/handover state;
- body/subject where needed.

Do NOT trust arbitrary body/recipient/provider config directly from claimed payload.

Required:
- event payload IDs must match source result;
- senderKind must be STAFF for E05;
- channel WHATSAPP or EMAIL;
- recipient nonblank;
- consent/opt-out preserved;
- idempotencyKey preserved;
- manual STAFF reply is not suppressed merely because human handover is active;
- provider secrets/config remain server-resolved elsewhere.

Produce existing `OutboxJob` purpose CUSTOMER_REPLY.

## INT4-W2-T6 — Channel behavior

WHATSAPP:
- manual freeform staff reply uses existing messaging adapter;
- provider acceptance is not delivery proof.

EMAIL:
- normalized subject/text/html from authoritative source;
- CUSTOMER_REPLY purpose;
- suppression still honors opt-out/hard-bounce;
- do not suppress a human reply solely due to handoverActive.

No Connector retry loop; Core E04 owns retry.

## INT4-W2-T7 — Delivery-state bridge preparation

Add an injected port/helper that can translate existing WhatsApp status transition outcomes into a business message delivery update command shape without directly mutating Core.

Map:
- PROVIDER_ACCEPTED
- DELIVERED
- READ
- FAILED

Preserve monotonic/terminal FAILED rules from prior work.
This helper should be ready for Core message delivery persistence after E05 integration.

## INT4-W2-T8 — Package-free harness + canonical tests

Add:
`tests/providers/runtime-outage-e05-whatsapp-core-handoff-harness.ts`

Cover:
- receipt INSERTED + Core APPLIED;
- receipt DUPLICATE + Core APPLIED after previous Core failure;
- later receipt DUPLICATE + Core DUPLICATE;
- Core failure => 503;
- invalid signature => no receipt/Core call;
- conversation reply intent rejects identity mismatch;
- CUSTOMER_REPLY WhatsApp success;
- CUSTOMER_REPLY Email success;
- opt-out suppression;
- human handover does not suppress STAFF reply;
- delivery-state helper preserves monotonic semantics;
- no raw provider body/secrets in Core-facing results.

Author focused canonical provider tests.

## Restrictions

- Stripe remains SANDBOX/DEMO.
- no Core repository access;
- no Product/UI changes;
- no business truth owned by Connector;
- no provider expansion.

## Receipt
`docs/execution/receipts/v1-int4-worker-2.md`

Return:
WORKER=2
SPRINT=V1-INT4
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E06 calendar/crew transition connector bridge
