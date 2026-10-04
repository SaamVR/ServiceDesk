# V1 Integration Sprint 1 — Worker 2 / Provider-Core Bridge

Branch: `feat/servicedesk-v1-connectors-sprint1`
Exact base: `714f24edfe7c6124237c7259a00ede7b288b68fb`
RC lineage: `rc/servicedesk-v1-unverified-20261004`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- this packet

## Mission
Stop expanding provider breadth. Prepare the existing provider implementation for authoritative Core integration, especially E03/E04/E05.

One normal Runtime recovery probe only; otherwise use outage mode.

## Required slices

### INT1-W2-T1 — RC connector compatibility audit
Add a package-free script/harness:
- `tests/providers/runtime-outage-integration-compatibility-harness.ts`

Scan the exact sprint tree for Connector/AI local relative imports and assert every target exists. Also assert connector-owned modules do not import Product/UI paths.

Fix connector-owned broken imports only if actually reproduced.

### INT1-W2-T2 — Provider-neutral committed outbox dispatch port
Add connector-owned:
- `src/server/integrations/outbox/dispatch-port.ts`

Define a stable injected boundary Core E04 can call without importing provider internals.

Input must preserve existing `OutboxJob` identity/idempotency/workspace/channel/purpose.

Output must distinguish:
- ACCEPTED
- RETRYABLE_FAILURE
- TERMINAL_FAILURE
- SUPPRESSED

and may include redacted provider evidence/provider message identity when available.

No business-truth mutation in this layer.

### INT1-W2-T3 — Dispatch router
Add:
- `src/server/integrations/outbox/dispatch-router.ts`

Route WHATSAPP / EMAIL / WEBHOOK through injected channel dispatchers.

Requirements:
- reject workspace/channel mismatch;
- preserve idempotency key;
- re-check existing recipient suppression/handover guard before dispatch;
- unsupported/missing channel dispatcher fails closed;
- no direct Core repository access.

Use injected fake channel dispatchers in tests; do not require live providers.

### INT1-W2-T4 — Retry classification bridge
Add:
- `src/server/integrations/outbox/failure-policy.ts`

Normalize existing connector error codes into the dispatch-port result:
- known timeout/network/rate-limit/transient → retryable;
- configuration/auth/invalid request/suppression → terminal or suppressed as appropriate;
- unknown errors fail closed as terminal unless source semantics prove retryability.

No raw provider body/secret in result.

### INT1-W2-T5 — Payment contract compatibility proof
Add a focused compile/static contract module/test proving:
`VerifiedPaymentWebhook["event"]` is the existing Core `VerifiedPaymentEvent` shape without field loss.

Do NOT invent mapping of Core application outcomes before Worker 1/Core E03 defines them.

Document exact remaining bridge dependency for E03:
Core must expose authoritative applied/duplicate/review outcome semantics.

### INT1-W2-T6 — WhatsApp inbound Core handoff boundary
Add an injected business-command port around the already-built durable inbound processor:
- stable receiptKey passed through;
- normalized text/media/unsupported semantics preserved;
- processor cannot directly mutate Core repositories;
- duplicate business command result maps to processor DUPLICATE;
- failure remains retryable and preserves receipt identity.

No new WhatsApp provider feature.

### INT1-W2-T7 — Combined outage harness + canonical tests
Execute package-free tests for dispatch routing, failure policy, payment shape parity, and inbound handoff boundary.

If pnpm recovers, run focused providers/AI/typecheck.

## Continue-until rule
Complete at least T1–T7 unless an exact dependency blocks a slice; continue all independent work. Do not end after one bridge.

## Output
2–3 implementation commits + compact receipt:
`docs/execution/receipts/v1-int1-worker-2.md`

Return:
WORKER=2
SPRINT=V1-INT1
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E03 payment bridge after Core authoritative outcome contract
