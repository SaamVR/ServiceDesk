# ServiceDesk AI — Cycle 4 Worker 2 / Connectors & AI — webhook error redaction hardening

Branch: `feat/servicedesk-v1-connectors`
Expected previous HEAD: `af47a5623232c96062a06323b884b35801f41f0b`

Read in full from the exact coordinator ref supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify the remote branch HEAD and preserve every legitimate newer Connector/AI commit.

Make only one quick normal Runtime recovery probe. If Git/npm/pnpm remain blocked, immediately use Runtime Outage Mode.

## Source-derived defect

Current durable WhatsApp inbound failure paths include arbitrary underlying exception messages in returned failure text.

Examples:
- `processDurableWhatsAppInboundBatch(...)` catches a processor exception and embeds `error.message`.
- `persistDurableWhatsAppInboundBatchWithRecords(...)` catches a store exception and embeds `error.message`.
- `handleDurableWhatsAppInboundWebhook(...)` returns those messages in the HTTP 503 body.

A downstream store/processor exception may contain internal database, infrastructure, tenant, token, or PII detail. Provider-facing webhook responses must not echo arbitrary backend exception text.

## CYCLE-4-W2-T1 — Redact processing error detail
Modify Worker-2-owned WhatsApp inbound code so:
1. failure code remains `WHATSAPP_INBOUND_PROCESSING_FAILED`;
2. message may retain the stable durable `receiptKey` for correlation;
3. arbitrary thrown exception text is NOT included in the returned Result message;
4. retry semantics remain unchanged.

Suggested public-safe shape:
`WhatsApp inbound processing failed for <receiptKey>.`

Do not add logging of secrets.

## CYCLE-4-W2-T2 — Redact persistence error detail
Apply the same rule to durable inbox persistence:
1. keep `WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED`;
2. keep the stable `receiptKey` if useful;
3. do not include arbitrary store exception text in the Result or provider-facing body;
4. preserve retryable 503 behavior.

## CYCLE-4-W2-T3 — Regression tests
Update canonical provider tests with sentinel secret-like backend errors, for example:
- processor throws `postgres://user:secret@internal-db/customer-email@example.com`;
- store throws `redis password=top-secret tenant=customer-123`.

Assert:
- 503 remains retryable and unacknowledged;
- response contains the typed error code;
- response can contain the durable receiptKey;
- response does NOT contain `secret`, internal URL, email, password, or tenant diagnostic text;
- retry-safe persist → process → ACK semantics from Cycle 3 remain unchanged.

## CYCLE-4-W2-T4 — Outage harness
Add:
`tests/providers/runtime-outage-whatsapp-error-redaction-harness.ts`

Use Node `assert` against the real changed inbound persistence/processor/handler code under global `ts-node --transpile-only`.

If pnpm recovers, run:
- focused WhatsApp inbound processor/durable handler tests;
- `pnpm vitest run tests/providers`;
- `pnpm vitest run tests/ai`;
- `pnpm typecheck`.

## Restrictions
- Worker-2-owned Connector/AI and provider-handler files only.
- Do not edit shared contracts, package files, API handler barrel, integrations barrel, Core, Product/UI, or coordinator docs.
- No live provider verification claim.

## Proof
Outage harness PASS permits `IMPLEMENTED`.
Canonical provider/AI/typecheck gate remains `CONFIGURATION_BLOCKED` until pnpm returns.
Do not claim `CONTRACT_TESTED` or `PROVIDER_VERIFIED`.

## Receipt
Write:
`docs/execution/receipts/worker-2-cycle-4.md`
