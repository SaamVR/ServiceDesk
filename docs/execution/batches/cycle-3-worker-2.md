# ServiceDesk AI — Cycle 3 Worker 2 / Connectors & AI — Outage Mode

Branch: `feat/servicedesk-v1-connectors`
Expected previous HEAD: `a43840d8e1f3d3da6ab0c212966bb2064de837a1`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify remote branch HEAD. Preserve all legitimate newer connector repairs.

Make only ONE quick normal Runtime recovery probe. If GitHub/npm/pnpm are still blocked, enter outage mode immediately.

## Correctness rule — retry safety
Do NOT implement the old "process only newly INSERTED records" idea.

That design is unsafe: if persistence succeeds and downstream processing fails, the provider retry will see a duplicate inbox row and could skip the failed processing.

Instead:
- durable persistence remains first;
- the processor is idempotent by the existing stable `receiptKey`;
- after persistence succeeds, invoke the processor for every durably persisted processable record, whether persistence returned `INSERTED` or `DUPLICATE`;
- processor returns `PROCESSED` or `DUPLICATE`;
- unsupported content remains explicit and is not invented;
- processor failure returns retryable 503 and no ACK;
- on provider retry, persistence may be `DUPLICATE` but processor is invoked again, allowing unfinished processing to complete safely.

## CYCLE-3-W2-T1 — Processor seam
Add Worker-2-owned:
- `src/server/integrations/whatsapp/inbound-processor.ts`

Contract:
- `DurableWhatsAppInboundProcessor.process(record)`
- result `"PROCESSED" | "DUPLICATE"`
- batch summary: received / processed / duplicate / unsupported
- typed failure `WHATSAPP_INBOUND_PROCESSING_FAILED` containing the durable `receiptKey`.

Do not mutate Core business truth directly.

## CYCLE-3-W2-T2 — Persistence record outcomes
Extend `src/server/integrations/whatsapp/inbox-persistence.ts` with a helper that returns both:
- the existing aggregate persistence summary;
- per-record durable persistence outcomes.

Preserve `persistDurableWhatsAppInboundBatch(...)` as a compatibility API.

The new result must retain the durable record for both `INSERTED` and `DUPLICATE`.

## CYCLE-3-W2-T3 — Compose persist → idempotent process → ACK
Modify:
- `src/server/api-handlers/provider-whatsapp-durable.ts`

Ordering:
1. verify Meta signature;
2. parse/normalize;
3. durably persist all records;
4. process all durably persisted processable records, including provider duplicates;
5. only ACK after processing succeeds.

Processing failure:
- status 503;
- `acknowledged:false`;
- `retryable:true`.

Do not edit the API handler barrel or shared integrations barrel.

## CYCLE-3-W2-T4 — Canonical tests + outage harness
Add/modify canonical provider tests for:
- unique TEXT → processed once;
- media remains `MEDIA_REFERENCE`;
- unsupported remains explicit;
- provider persistence duplicate still reaches idempotent processor;
- processor duplicate is safe;
- processor failure after persistence returns retryable 503;
- retry after that failure can process the already-persisted duplicate and then ACK;
- later retry after successful processing returns processor `DUPLICATE` without a second logical action;
- invalid signature calls neither store nor processor.

Also add:
- `tests/providers/runtime-outage-whatsapp-inbound-harness.ts`

Run exact changed source under global `ts-node --transpile-only` with Node assert.

The coordinator independently validated the corrected retry-safe pattern in GPT Runtime.

If pnpm recovers, run focused WhatsApp tests, full `tests/providers`, `tests/ai`, and `pnpm typecheck`.

## Proof
Outage harness PASS permits `IMPLEMENTED`.
Without canonical Vitest/typecheck, keep canonical gate `CONFIGURATION_BLOCKED`.
Do not claim `CONTRACT_TESTED` or `PROVIDER_VERIFIED`.

## Receipt
Write `docs/execution/receipts/worker-2-cycle-3.md`.

Return:
`WORKER=2`
`CYCLE=3`
`FINAL_SHA=<sha>`
`RECEIPT=docs/execution/receipts/worker-2-cycle-3.md`
`STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>`
`CANONICAL_GATE=<state>`
