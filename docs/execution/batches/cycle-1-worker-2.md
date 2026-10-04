# ServiceDesk AI — Cycle 1 Worker 2 Connectors/AI Batch

Published by dedicated coordinator on 2026-10-04. Revised after fresh branch reconciliation.

## Retrieval / branch
- Worker model: GPT-5.5 High
- Worker branch: `feat/servicedesk-v1-connectors`
- Current worker branch head observed by coordinator: `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a`
- Integration head at revision start: `71e0579869694bf6db8de5660e16f21df390a3e3`
- Contract source: `docs/contracts-v1.md` + `src/contracts/**` on integration.
- Preserve every legitimate commit newer than the observed head. Never reset/rebase/force-push.

## Coordinator observations before dispatch
- Worker 2 ownership is `src/server/ai/**`, `src/server/integrations/**`, provider handler internals, `tests/ai/**`, `tests/providers/**`, and `examples/n8n/**`.
- The current branch advanced after the first packet was drafted. Its ledger records connector compile/test repairs and a test run performed on `samvr`. Preserve the repaired source, but the new coordinator contract explicitly disallows samvr/samai/local-device evidence. That historical run is therefore not the Runtime-only acceptance gate.
- Current source already contains durable WhatsApp normalization and persistence:
  - `normalizeWhatsAppInboundMessage(message): NormalizedWhatsAppInboundEvent`
  - `NormalizedWhatsAppInboundEvent.receiptKey`
  - `buildDurableWhatsAppInboxRecord(message, rawProviderEventRef): DurableWhatsAppInboxRecord`
  - `persistDurableWhatsAppInboundBatch(input): Promise<Result<DurableWhatsAppInboundBatchSummary>>`
  - `handleDurableWhatsAppInboundWebhook(input): Promise<ProviderHandlerResult>`
- `handleDurableWhatsAppInboundWebhook` currently verifies signature, parses, groups, persists, and ACKs. It does not yet hand persisted records to an explicit idempotent processor.
- The coordinator's own GPT Runtime currently cannot resolve `github.com` or `registry.npmjs.org`; that is a Runtime blocker, not a test result. Retry independently in your GPT Runtime and record exact output.
- Do not claim live-provider proof from fixture tests. No `PROVIDER_VERIFIED` label without controlled provider receipts.

## Allowed paths
Primary implementation paths:
- `src/server/integrations/**`
- `src/server/ai/**`
- `src/server/api-handlers/provider-*`
- `tests/providers/**`
- `tests/ai/**`
- `examples/n8n/**`

Receipt path:
- `docs/execution/receipts/worker-2-cycle-1.md`

Forbidden unless a later coordinator packet grants exclusive ownership:
- `src/contracts/**`
- `src/server/core/**`, `src/domain/**`, `supabase/migrations/**`
- `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `docs/taskboard.md`, `docs/execution/coordinator-ledger.md`, integration branch

## Batch objective
First re-prove the current repaired connector branch in GPT Runtime. If and only if that executable gate is green, continue directly into the already-planned durable WhatsApp inbound processor composition so this run delivers a real capability rather than stopping after verification.

---

## CYCLE-1-W2-T1 — Re-prove current connector gate in GPT Runtime

State: READY  
Dependency: none  
Base SHA: `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a`  
Contract version: frozen V1 contracts on integration  
Capability outcome: current repaired connector head has fresh Runtime-only compile/provider/AI evidence, or an exact Runtime/non-owned blocker.

Steps:
1. Verify:
   ```bash
   pwd
   node --version
   npm --version
   corepack --version || true
   pnpm --version || true
   df -h . /tmp
   getent hosts github.com || true
   getent hosts registry.npmjs.org || true
   git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors
   ```
2. In GPT Runtime only, use an isolated checkout of the current remote branch and preserve any newer head.
3. Run:
   ```bash
   corepack prepare pnpm@10.17.1 --activate || true
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm vitest run tests/providers
   pnpm vitest run tests/ai
   ```

Acceptance:
- GREEN only when all commands actually pass in GPT Runtime.
- ACTIVE_REPAIR when failures are Worker-2-owned.
- BLOCKED when checkout/install cannot execute or the first failure requires a forbidden/shared path.
- Do not reuse the historical samvr PASS as this task's evidence.

---

## CYCLE-1-W2-T2 — Repair only current Worker-2-owned failures

State: READY_AFTER_T1_OWNED_FAILURE  
Dependency: `CYCLE-1-W2-T1` returns Worker-2-owned failures  
Capability outcome: current repaired branch is executable without repeating already-fixed historical work unnecessarily.

Inspect the exact Runtime errors first. Likely prior-repair surfaces include:
- `src/server/ai/index.ts`
- `src/server/integrations/index.ts`
- payment/Stripe lifecycle typing
- WhatsApp template/dispatcher result typing
- recovery/operations export naming
- failing tests under `tests/providers/**` and `tests/ai/**`

Rules:
- Preserve fixes already present at the current head.
- Do not widen `src/contracts/**` or core facade signatures.
- Repair only failures reproduced by T1.
- Keep behavior + tests in the same coherent commit.

Verification:
```bash
pnpm typecheck
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

Stopping rule:
- If any remaining failure is non-owned, publish the receipt and stop. Do not bypass it.

---

## CYCLE-1-W2-T3 — Add explicit idempotent WhatsApp inbound processor port

State: READY_IF_T1_GREEN_OR_AFTER_T2_GREEN  
Dependency: executable connector gate is green  
Capability outcome: durable inbound records have an explicit connector-owned processing handoff whose duplicate identity is `receiptKey`.

Allowed/new source:
- new `src/server/integrations/whatsapp/inbound-processor.ts`
- `src/server/integrations/index.ts` only if exporting the new connector-owned module is necessary

Required signatures:
```ts
export interface DurableWhatsAppInboundProcessor {
  process(record: DurableWhatsAppInboxRecord): Promise<"PROCESSED" | "DUPLICATE">;
}

export interface ProcessDurableWhatsAppInboundBatchSummary {
  received: number;
  processed: number;
  duplicate: number;
  unsupported: number;
}

export function processDurableWhatsAppInboundBatch(
  records: DurableWhatsAppInboxRecord[],
  processor: DurableWhatsAppInboundProcessor,
): Promise<Result<ProcessDurableWhatsAppInboundBatchSummary>>;
```

Behavior:
- Process durable records only; no direct business-table mutation.
- Duplicate identity is the existing `record.receiptKey`.
- Unsupported records remain explicit and count as unsupported; do not invent text.
- Processor errors return a typed `Result` failure carrying the receipt key, so the provider handler can return retryable failure.

Test inputs/assertions:
- unique TEXT record → processed 1;
- duplicate processor response → duplicate 1;
- MEDIA_REFERENCE remains intact;
- UNSUPPORTED remains unsupported;
- thrown processor error becomes typed failure, not successful ACK.

Focused command:
```bash
pnpm vitest run tests/providers/whatsapp-inbound-processor.test.ts
```

---

## CYCLE-1-W2-T4 — Compose persist → processor → ACK

State: READY_AFTER_T3  
Dependencies: `CYCLE-1-W2-T3`  
Capability outcome: verified inbound webhook is durably persisted before processor handoff and is not acknowledged when processing fails.

Modify:
- `src/server/api-handlers/provider-whatsapp-durable.ts`
- `tests/providers/whatsapp-durable-inbound-handler.test.ts`

Consumed signatures:
- `persistDurableWhatsAppInboundBatch(...)`
- `buildDurableWhatsAppInboxRecord(...)`
- new `DurableWhatsAppInboundProcessor`
- existing `ProviderHandlerResult`

Implementation decision:
- Extend `DurableWhatsAppInboundWebhookInput` with the processor port.
- Preserve ordering: signature verification → parse/normalize → durable persistence → processor handoff → ACK.
- Only records reported newly inserted by the durable store should be logically handed off as new work; duplicate webhook delivery must not create a second business action.
- Processor failure after persistence returns HTTP 503, `acknowledged:false`, `retryable:true`.
- A provider retry must be safe because receipt identity is stable and processor handling is idempotent.
- Do not add direct core/database writes from the handler.

Tests:
- mixed text/media/unsupported batch;
- provider duplicate;
- processor failure after persistence then callback retry;
- successful retry yields one logical processing effect per unique receipt key;
- invalid signature remains non-retryable and never invokes persistence/processor.

Focused command:
```bash
pnpm vitest run tests/providers/whatsapp-durable-inbound-handler.test.ts tests/providers/whatsapp-inbound-processor.test.ts tests/providers/whatsapp-inbound-normalization.test.ts
```

---

## CYCLE-1-W2-T5 — Regression, receipt, and pinned range

State: READY_AFTER_T4  
Dependencies: T1–T4 complete  
Capability outcome: coordinator receives a reviewable connector range with fresh Runtime proof and no ambiguous local-device evidence.

Run one broader regression:
```bash
pnpm typecheck
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

Create:
- `docs/execution/receipts/worker-2-cycle-1.md`

Receipt records:
- observed start SHA and final SHA;
- each task state;
- exact changed files;
- exact commands/results;
- historical samvr evidence separately labelled `NOT_ACCEPTED_FOR_CURRENT_RUNTIME_GATE`;
- current proof labels (fixture suites may be `CONTRACT_TESTED`; live providers remain `CONFIGURATION_BLOCKED` or not verified);
- first unresolved blocker, if any;
- recommended next task.

Commit/push coherent changes to `feat/servicedesk-v1-connectors`. Do not edit the global taskboard or integration branch.

## Independent fallbacks
Use only if Runtime execution is blocked or a non-owned failure stops the primary path:
1. Static barrel audit of every export in `src/server/integrations/index.ts` and `src/server/ai/index.ts`; save findings in the receipt only. No PASS claim.
2. Static proof-label audit in Worker-2-owned docs/tests for unsupported `PROVIDER_VERIFIED` claims; correct only Worker-2-owned false claims. No feature expansion.

## Stop condition
- If GPT Runtime cannot clone/install/run tests, publish the exact blocker receipt and stop unchecked expansion.
- If T1/T2 becomes green, continue through T3–T5 in the same run; do not stop after the verification gate.
- Do not start unrelated E03+ work in Cycle 1.
