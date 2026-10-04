# V1 Integration Sprint 3 — Worker 2 / Outbox Connector Executor

Branch: `feat/servicedesk-v1-connectors-sprint3`
Exact base: `b744bbba9c02904a5981e09c8d064face0de4a90`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

The coordinator has frozen `src/contracts/outbox.ts`.
Do not modify it.

## Mission
Complete the Connector side of E04 by adapting a claimed Core outbox event to the existing provider-neutral committed-dispatch layer.

Do not add provider families.

## Required slices

### INT3-W2-T1 — Authoritative delivery-intent resolver port
Add:
- `src/server/integrations/outbox/intent-resolver.ts`

Define an injected resolver:
`resolve(ClaimedOutboxEvent) -> Result<OutboxJob>`

The resolver is supplied by server composition/Core read model later.
Connector code must not query Core repositories directly.

Validate resolved job identity:
- job.id == claimed event.id;
- workspace matches;
- idempotencyKey matches;
- channel/purpose present;
- recipient reference nonblank.

Mismatch => terminal fail-closed before provider call.

### INT3-W2-T2 — Shared outbox execution adapter
Add:
- `src/server/integrations/outbox/execution-adapter.ts`

Implement frozen `OutboxExecutionPort` using:
- injected intent resolver;
- existing `dispatchCommittedOutboxJob`;
- injected channel dispatchers.

Map:
- ACCEPTED -> SENT
- RETRYABLE_FAILURE -> RETRYABLE_FAILURE
- TERMINAL_FAILURE -> TERMINAL_FAILURE
- SUPPRESSED -> SUPPRESSED

Preserve providerMessageId as providerReference only on SENT.
Do not leak raw evidence/secret material into Core result.

### INT3-W2-T3 — WhatsApp channel dispatcher adapter
Add an adapter from existing `MessagingAdapter` to `CommittedOutboxDispatcher`.

Requirements:
- use exact OutboxJob idempotency/workspace/recipient/purpose;
- map successful ProviderSendResult to ACCEPTED;
- classify known provider failures via existing failure policy;
- no retry loop inside Connector; Core E04 worker owns retry.

### INT3-W2-T4 — Email channel dispatcher adapter
Adapt existing `TransactionalEmailAdapter`.

Require resolver-produced payload to contain the normalized transactional fields needed by Email:
- to
- subject
- text/html
- purpose mapping

Missing/malformed fields => TERMINAL_FAILURE before provider call.
Suppression from email adapter => SUPPRESSED.

No direct customer lookup in Connector.

### INT3-W2-T5 — Webhook channel dispatcher adapter
Adapt existing signed webhook executor using an injected normalized webhook envelope/config/transport resolver boundary.

No endpoint/secret may be taken from untrusted event payload without server-side resolver validation.
Map retry/terminal/delivered outcomes to committed dispatch semantics.

### INT3-W2-T6 — Redaction/identity regressions
Prove:
- resolver mismatch calls no provider;
- idempotency survives all mappings;
- providerReference returned only after acceptance;
- failure outcome contains no access token, email body, raw webhook response, recipient PII or raw provider event.

### INT3-W2-T7 — Combined outage harness
Add:
- `tests/providers/runtime-outage-outbox-execution-adapter-harness.ts`

Use injected fixture provider adapters.
Cover WHATSAPP/EMAIL/WEBHOOK success, suppression, retryable, terminal and identity mismatch.

### INT3-W2-T8 — Canonical tests
Author focused tests for resolver/adapter/channel mappings.
If pnpm recovers, run providers + typecheck.

## Restrictions
- Stripe stays sandbox/demo.
- no Core repository access;
- no retry persistence in Connector;
- no Product/UI changes;
- no shared contract edits.

## Continue rule
Complete all independent T1–T8.

## Receipt
`docs/execution/receipts/v1-int3-worker-2.md`

Return:
WORKER=2
SPRINT=V1-INT3
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E05 WhatsApp/inbox Core handoff integration
