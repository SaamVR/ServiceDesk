# ServiceDesk AI — Worker 2 Cycle 2 Receipt

Worker: 2 — Connectors/AI  
Cycle: 2  
Branch: `feat/servicedesk-v1-connectors`  
Coordinator packet ref: `d52cf62f22e9124078d7c25b05b00ba23556548b`  
Packet read: `AGENTS.md`, `docs/execution/coordinator-four-chat-20261004.md`, `docs/execution/batches/cycle-2-worker-2.md`  
Start SHA observed before Cycle 2: `a9fc2de46ce63b44b394718edc98e0dc07a4a354`  
Receipt commit SHA: pending at creation time

## State

`BLOCKED`

## GPT Runtime-only gate result

Cycle 2 required GPT Runtime Machine only. No samvr, samai, SSH/local device, self-hosted runner, or GitHub Actions were used.

The current GPT Runtime remains infrastructure-blocked before checkout/package install.

Commands attempted in GPT Runtime:

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

Observed output:

```text
PWD=/
v22.16.0
10.9.2
0.32.0
bash: line 7: pnpm: command not found
Filesystem      Size  Used Avail Use% Mounted on
overlay          32G  5.5M   30G   1% /
overlay          32G  5.5M   30G   1% /
fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
```

Because checkout failed, the following required executable commands were not run:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

No Runtime-only test PASS is claimed. Historical samvr evidence remains `NOT_ACCEPTED_FOR_CURRENT_RUNTIME_GATE`.

## Current remote branch verification

Remote branch inspected through connected GitHub read access only:

- Branch: `feat/servicedesk-v1-connectors`
- HEAD at Cycle 2 start: `a9fc2de46ce63b44b394718edc98e0dc07a4a354`
- Parent: `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a`

Connected GitHub read/write access is not executable proof; it was used only because Runtime Git transport is blocked.

## Application source changes

None.

The Cycle 2 packet explicitly says that if Runtime is still blocked, do not change application source. This receipt is the only durable change.

## Static WhatsApp implementation map fallback

### Current files inspected

- `src/server/api-handlers/provider-whatsapp-durable.ts`
- `src/server/integrations/whatsapp/inbox-persistence.ts`
- `src/server/integrations/whatsapp/inbound-normalization.ts`
- `tests/providers/whatsapp-durable-inbound-handler.test.ts`
- `tests/providers/whatsapp-inbound-batch.test.ts`
- `tests/providers/whatsapp-inbound-normalization.test.ts`

### Current source signatures found

`src/server/api-handlers/provider-whatsapp-durable.ts`

```ts
export type DurableWhatsAppInboundWebhookStore = DurableWhatsAppInboxStore;

export interface DurableWhatsAppInboundWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  appSecret: string;
  workspaceByPhoneNumberId: Record<string, string>;
  store: DurableWhatsAppInboundWebhookStore;
}

export async function handleDurableWhatsAppInboundWebhook(
  input: DurableWhatsAppInboundWebhookInput,
): Promise<ProviderHandlerResult>;
```

Current behavior in this handler:

1. Verifies Meta signature with `verifyMetaSignature(...)`.
2. Parses JSON.
3. Extracts messages through `parseInboundMessages(...)`.
4. Groups messages by `workspaceId:phoneNumberId`.
5. Calls `persistDurableWhatsAppInboundBatch(...)` per group.
6. ACKs with `{ received, inserted, duplicate, unsupported }` after persistence succeeds.
7. Returns retryable `503` only on persistence failure.

Gap: there is no explicit processor port, and ACK currently happens after persistence only, not after persistence plus processor handoff.

`src/server/integrations/whatsapp/inbox-persistence.ts`

```ts
export interface DurableWhatsAppInboxRecord extends NormalizedWhatsAppInboundEvent {
  rawProviderEventRef: string;
}

export interface DurableWhatsAppInboundBatchSummary {
  received: number;
  inserted: number;
  duplicate: number;
  unsupported: number;
}

export interface DurableWhatsAppInboxStore {
  persist(record: DurableWhatsAppInboxRecord): Promise<"INSERTED" | "DUPLICATE">;
}

export interface PersistDurableWhatsAppInboundBatchInput {
  messages: WhatsAppInboundMessage[];
  rawProviderEventRef: string;
  store: DurableWhatsAppInboxStore;
}

export function rawWhatsAppProviderEventRef(input: RawWhatsAppProviderEventRefInput): string;
export function buildDurableWhatsAppInboxRecord(
  message: WhatsAppInboundMessage,
  rawProviderEventRef: string,
): DurableWhatsAppInboxRecord;
export async function persistDurableWhatsAppInboundBatch(
  input: PersistDurableWhatsAppInboundBatchInput,
): Promise<Result<DurableWhatsAppInboundBatchSummary>>;
```

Current persistence behavior:

- Converts each provider message to `DurableWhatsAppInboxRecord` through `buildDurableWhatsAppInboxRecord(...)`.
- Uses `record.receiptKey` from normalization.
- Counts unsupported records without dropping identity.
- Calls `store.persist(record)` and counts `INSERTED` vs `DUPLICATE`.
- On store error returns `WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED` with the failing `receiptKey`.

Gap: `persistDurableWhatsAppInboundBatch(...)` returns counts only, not the persisted records or inserted-vs-duplicate record list. To process only logically new records, the handler needs either:

A. a new persistence helper that returns per-record persistence outcomes; or  
B. an extended summary shape containing records/results; or  
C. composition inside the handler using `buildDurableWhatsAppInboxRecord(...)` plus store calls directly.

Recommended option: add a new Worker-2-owned helper that preserves the existing public function and tests, for minimal regression risk.

`src/server/integrations/whatsapp/inbound-normalization.ts`

```ts
export type NormalizedInboundContentKind = "TEXT" | "MEDIA_REFERENCE" | "UNSUPPORTED";

export interface NormalizedWhatsAppInboundEvent {
  provider: "WHATSAPP";
  workspaceId: string;
  providerAccountId: string;
  phoneNumberId: string;
  providerMessageId: string;
  receiptKey: string;
  senderRef: string;
  providerTimestamp: string;
  channel: "WHATSAPP";
  contentKind: NormalizedInboundContentKind;
  text?: string;
  media?: { provider: "WHATSAPP"; providerMediaId: string };
  rawPayloadIncluded: false;
  aiAuthoritative: false;
}

export function whatsappInboundReceiptKey(
  input: Pick<WhatsAppInboundMessage, "workspaceId" | "phoneNumberId" | "providerMessageId">,
): string;

export function normalizeWhatsAppInboundMessage(message: WhatsAppInboundMessage): NormalizedWhatsAppInboundEvent;
export function summarizeNormalizedInboundBatch(events: NormalizedWhatsAppInboundEvent[]): NormalizedInboundBatchSummary;
```

Current receipt identity:

```ts
`${workspaceId}:${phoneNumberId}:${providerMessageId}`
```

This is the correct stable processor idempotency key. No second inbound identity should be invented.

### Proposed implementation files and ownership

Allowed, Worker-2-owned:

- New: `src/server/integrations/whatsapp/inbound-processor.ts`
- Modify: `src/server/api-handlers/provider-whatsapp-durable.ts`
- Modify or extend carefully: `src/server/integrations/whatsapp/inbox-persistence.ts`
- New: `tests/providers/whatsapp-inbound-processor.test.ts`
- Modify: `tests/providers/whatsapp-durable-inbound-handler.test.ts`
- Existing tests preserved: `tests/providers/whatsapp-inbound-normalization.test.ts`, `tests/providers/whatsapp-inbound-batch.test.ts`

Possible export path:

- `src/server/integrations/index.ts` is Worker-2-owned in the original lane ownership, but the coordinator rules say shared barrels are coordinator-owned. Cycle 2 specifically forbids coordinator-owned API handler barrel and package files, but does not explicitly forbid the integrations barrel. To avoid conflict, do not edit `src/server/integrations/index.ts` unless the coordinator explicitly confirms this export is required. Direct imports in tests can target the new module path.

No edits to:

- `src/contracts/**`
- `src/server/core/**`
- `src/domain/**`
- `supabase/migrations/**`
- `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`
- `package.json`, lockfiles, workspace files
- API handler barrel
- coordinator ledger/taskboard/integration branch

### Proposed new processor contract

File: `src/server/integrations/whatsapp/inbound-processor.ts`

```ts
import type { Result } from "../../../contracts";
import type { DurableWhatsAppInboxRecord } from "./inbox-persistence";

export type DurableWhatsAppInboundProcessorResult = "PROCESSED" | "DUPLICATE";

export interface DurableWhatsAppInboundProcessor {
  process(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboundProcessorResult>;
}

export interface ProcessDurableWhatsAppInboundBatchSummary {
  received: number;
  processed: number;
  duplicate: number;
  unsupported: number;
}

export async function processDurableWhatsAppInboundBatch(
  records: DurableWhatsAppInboxRecord[],
  processor: DurableWhatsAppInboundProcessor,
): Promise<Result<ProcessDurableWhatsAppInboundBatchSummary>>;
```

Required behavior:

- Count every input record in `received`.
- If `record.contentKind === "UNSUPPORTED"`, increment `unsupported` and do not ask the processor to invent content.
- For `TEXT` and `MEDIA_REFERENCE`, call `processor.process(record)`.
- If processor returns `PROCESSED`, increment `processed`.
- If processor returns `DUPLICATE`, increment `duplicate`.
- If processor throws, return a typed `Result` failure such as:

```ts
{
  ok: false,
  code: "WHATSAPP_INBOUND_PROCESSING_FAILED",
  message: `WhatsApp inbound processing failed for ${record.receiptKey}: ${detail}`,
}
```

- Media must stay a `MEDIA_REFERENCE`; no download or text inference in this seam.
- The processor port must not mutate Core business truth directly. It is a handoff seam for downstream conversation/intake orchestration.

### Required persistence-to-processing composition

Current handler receives only aggregate `inserted`/`duplicate` counts from `persistDurableWhatsAppInboundBatch(...)`. To process only logically new records, introduce a record-outcome path.

Recommended new helper in `inbox-persistence.ts`:

```ts
export interface DurableWhatsAppInboxPersistedRecord {
  record: DurableWhatsAppInboxRecord;
  persistence: "INSERTED" | "DUPLICATE";
}

export interface DurableWhatsAppInboundPersistRecordsResult {
  summary: DurableWhatsAppInboundBatchSummary;
  records: DurableWhatsAppInboxPersistedRecord[];
}

export async function persistDurableWhatsAppInboundRecords(
  input: PersistDurableWhatsAppInboundBatchInput,
): Promise<Result<DurableWhatsAppInboundPersistRecordsResult>>;
```

Then keep `persistDurableWhatsAppInboundBatch(...)` as a compatibility wrapper over the new helper:

```ts
const persisted = await persistDurableWhatsAppInboundRecords(input);
if (!persisted.ok) return persisted;
return { ok: true, value: persisted.value.summary };
```

### Handler composition map

Extend `DurableWhatsAppInboundWebhookInput`:

```ts
processor: DurableWhatsAppInboundProcessor;
```

New order in `handleDurableWhatsAppInboundWebhook(...)`:

1. Verify signature.
2. Parse JSON.
3. Extract `messages` through `parseInboundMessages(...)`.
4. Group by `workspaceId:phoneNumberId` as today.
5. For each group, call `persistDurableWhatsAppInboundRecords(...)` with redacted `rawWhatsAppProviderEventRef(...)`.
6. Accumulate persistence summary.
7. Build `recordsForProcessing` from `records.filter(item => item.persistence === "INSERTED").map(item => item.record)`.
8. Call `processDurableWhatsAppInboundBatch(recordsForProcessing, input.processor)`.
9. If processing fails, return:

```ts
{
  statusCode: 503,
  body: `${processed.code}: ${processed.message}`,
  acknowledged: false,
  retryable: true,
}
```

10. ACK only after both persistence and processing succeed.
11. Response body should include persistence and processing summaries, for example:

```json
{
  "received": 3,
  "inserted": 2,
  "duplicate": 1,
  "unsupported": 0,
  "processed": 2,
  "processorDuplicate": 0,
  "processorUnsupported": 0
}
```

Exact response shape can be chosen during implementation, but tests must assert no false ACK when processor fails.

### Required tests

New file: `tests/providers/whatsapp-inbound-processor.test.ts`

Cases:

1. Unique TEXT record:
   - input: one durable text record with `receiptKey="ws:phone:wamid-text"`.
   - processor returns `PROCESSED`.
   - expect `{ received: 1, processed: 1, duplicate: 0, unsupported: 0 }`.
   - assert processor saw the same `receiptKey` and `contentKind="TEXT"`.

2. Duplicate processor response:
   - processor returns `DUPLICATE` for a durable text/media record.
   - expect duplicate count increments and processed remains 0.

3. Media reference remains intact:
   - durable record has `contentKind="MEDIA_REFERENCE"` and `media.providerMediaId="media-1"`.
   - processor receives `media` unchanged.
   - no text field invented.

4. Unsupported stays explicit:
   - durable record has `contentKind="UNSUPPORTED"`.
   - processor is not called, or if coordinator prefers downstream observation, processor receives unsupported but must not invent content. The safer map is not called.
   - expect unsupported count increments.

5. Processor error:
   - processor throws `conversation store down`.
   - result is `{ ok: false, code: "WHATSAPP_INBOUND_PROCESSING_FAILED" }`.
   - message includes the exact durable `receiptKey` and redacted detail only.

Modify: `tests/providers/whatsapp-durable-inbound-handler.test.ts`

Add cases:

1. Mixed text/media/unsupported batch:
   - raw webhook includes text, image, unsupported payload.
   - store persists all normalized records.
   - processor receives only logically new processable records, with media as `MEDIA_REFERENCE`.
   - handler returns 200 after processing success.

2. Provider duplicate:
   - same provider message appears twice.
   - store reports first `INSERTED`, second `DUPLICATE`.
   - processor is called once for that stable `receiptKey`.

3. Processor failure after persistence:
   - store persists successfully.
   - processor throws for a known `receiptKey`.
   - handler returns `{ statusCode: 503, acknowledged: false, retryable: true }`.
   - persistence happened before failure.

4. Retry remains safe:
   - after failure, invoke same webhook again with store already containing the receipt key.
   - store returns `DUPLICATE` for existing record.
   - processor does not create a second logical action for duplicate persisted record.
   - expected ACK on retry only if required processing work is complete or duplicate-safe, depending on the chosen processor/store simulation.

5. Invalid signature:
   - signature mismatch.
   - handler returns non-retryable 401.
   - store and processor are not called.

Existing focused regression should still include:

```bash
pnpm vitest run tests/providers/whatsapp-inbound-processor.test.ts tests/providers/whatsapp-durable-inbound-handler.test.ts tests/providers/whatsapp-inbound-normalization.test.ts
```

Broader regression after implementation:

```bash
pnpm typecheck
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

### Ownership conflicts

No confirmed ownership conflict in the implementation files above if no shared barrel is edited.

Potential conflict:

- `src/server/integrations/index.ts` is a broad export barrel. Historical Worker 2 plans allowed it, but the coordinator document now says shared barrel exports are coordinator-owned. Avoid editing it in this cycle unless the coordinator grants explicit exclusive ownership.

### Proof labels

- Static inspection only: no `CONTRACT_TESTED` added by this cycle.
- Existing fixture/provider suites remain unexecuted in GPT Runtime for Cycle 2.
- No `PROVIDER_VERIFIED` claim is made.
- Live providers remain unverified / configuration-dependent.

## Changed files

Only this receipt:

- `docs/execution/receipts/worker-2-cycle-2.md`

## Blocker

`BLOCKED_RUNTIME_CHECKOUT_DNS`

Runtime cannot resolve `github.com`, so it cannot clone or fetch the repository with Git. `pnpm` is not available before Corepack activation, and package/test execution cannot begin without a Runtime checkout.

## Recommended next task

Coordinator should repair GPT Runtime DNS/Git access or provide a Runtime-accessible repository materialization. Then rerun Cycle 2 from T1. If T1 becomes green, continue immediately into T3/T4 implementation and T5 regression; do not stop after verification.
