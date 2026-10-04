# Worker 2 V1-INT4 / INT4B Receipt — WhatsApp Inbox / Core Handoff

Repository: `SaamVR/ServiceDesk`  
Branch: `feat/servicedesk-v1-connectors-sprint4`

## INT4 baseline

Original coordinator ref: `9ce12193caf3d2104168931b28efeeaf22a9d531`  
Original start SHA: `602e581c1df860480c230da893128c0d1b8ca395`  
Original final SHA before INT4B: `8f78bb25bccb72c48e23ab99c17ebf454ff3b5a7`

## INT4B reconciliation

Coordinator ref: `184331936ba6c81a1d216c7d866d8b62bd2c5b10`  
Expected current HEAD at start: `8f78bb25bccb72c48e23ab99c17ebf454ff3b5a7`  
Implementation SHA before this receipt: `c5e201759eb804c530c8589f805fb8a800222464`  
Supabase staging project checked: `cpmmgivhlkfbiwzhlcey`

## State

STATE: `IMPLEMENTED`  
CANONICAL_GATE: `CONFIGURATION_BLOCKED`  
TIMESTAMP_BRIDGE: `PASS`  
RECEIPT_SCHEMA_ALIGNMENT: `PASS`  
STAGING_RECEIPT_PROOF: `BLOCKED_ON_CORE_0008`

## Runtime / canonical gate

GPT Runtime probe remains blocked for normal Git/npm tooling:

```text
pwd=/
node --version -> v22.16.0
npm --version -> 10.9.2
corepack --version -> 0.32.0
pnpm --version -> bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors-sprint4 -> fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com
```

Normal pnpm/Vitest/typecheck remains unavailable, so INT4B used Runtime Outage Mode for package-free TypeScript harness proof.

## Supabase staging schema check

Project checked: `cpmmgivhlkfbiwzhlcey` only.

Read-only query:

```sql
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'provider_inbound_receipts'
order by ordinal_position;
```

Result: `[]`

`public.provider_inbound_receipts` is not present yet on staging, so no insert/duplicate proof was run and no competing schema was created. Staging proof remains blocked on Worker 1/Core `0008` landing the corrected provider receipt schema.

## INT4B changes

### 1. WhatsApp timestamp normalization

Added:
- `src/server/integrations/whatsapp/timestamp-normalization.ts`

Behavior:
- Unix seconds string, for example `1791110400`, converts to ISO: `2026-10-04T10:40:00.000Z`.
- Unix milliseconds string, for example `1791110400000`, converts to the same ISO instant.
- Valid ISO input is normalized through `Date#toISOString()`.
- Malformed / ambiguous numeric / blank values throw `PROVIDER_TIMESTAMP_INVALID`.
- No current-time guessing.

Updated:
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`

Core now receives `InboundMessageEvent.occurredAt` as a valid ISO timestamp only. Malformed timestamps fail closed before Core is called and flow through existing retryable webhook failure behavior.

### 2. Provider receipt record minimization

Updated:
- `src/server/integrations/whatsapp/provider-receipt-store.ts`

Canonical technical receipt row now includes only:
- `receiptKey`
- `workspaceId`
- `provider`
- `providerAccountId`
- `providerMessageId`
- `senderRef`
- `providerOccurredAt`
- `rawProviderEventRef`
- `contentKind`

The receipt row no longer carries duplicated text body, media provider/media id, raw webhook body, access tokens, raw payload flags, or AI authority flags.

The in-memory `DurableWhatsAppInboxRecord` still carries text/media for the current webhook execution so Core can apply business messages without storing duplicated content in the technical receipt table.

### 3. Concrete Supabase receipt gateway

Added in `provider-receipt-store.ts`:
- `createSupabaseWhatsAppProviderReceiptGateway(client, options?)`
- dependency-injected Supabase client shape
- snake_case DB insert mapping:
  - `receipt_key`
  - `workspace_id`
  - `provider`
  - `provider_account_id`
  - `provider_message_id`
  - `sender_ref`
  - `provider_occurred_at`
  - `raw_provider_event_ref`
  - `content_kind`

Behavior:
- insert success => `INSERTED`
- unique/duplicate error => lookup existing receipt by `receipt_key`, or provider/account/message identity fallback
- existing duplicate must match workspace/provider/account/message/sender/contentKind or it fails closed with `WHATSAPP_RECEIPT_IDENTITY_CONFLICT`
- no project keys embedded
- no schema creation
- no raw provider payload persisted

### 4. Retry semantics preserved

Outage harness proves:
- First callback: receipt `INSERTED` → Core `APPLIED` → ACK.
- Core failure after receipt insert: provider retry → receipt `DUPLICATE` → Core called again → `APPLIED` → ACK.
- Later retry: receipt `DUPLICATE` → Core `DUPLICATE` → ACK without second business action.
- Invalid signature: no receipt and no Core call.

### 5. CUSTOMER_REPLY contract preserved

No behavior broadening beyond INT4:
- `CUSTOMER_REPLY` remains the delivery purpose for staff replies.
- Human staff reply is not suppressed merely by handover state.
- Opt-out/hard-bounce still suppress.
- Recipient/body are sourced from authoritative resolver output, not arbitrary claimed outbox payload.

### 6. Delivery-state bridge unchanged in authority

The WhatsApp delivery-state bridge remains preparation only:
- it does not mutate Core directly;
- provider accepted is not delivered;
- existing terminal/non-regressive `FAILED` semantics remain the source of truth for transition decisions.

## Changed files in INT4B

- `src/server/integrations/whatsapp/timestamp-normalization.ts`
- `src/server/integrations/whatsapp/inbound-core-handoff.ts`
- `src/server/integrations/whatsapp/provider-receipt-store.ts`
- `tests/providers/e05-whatsapp-timestamp-normalization.test.ts`
- `tests/providers/e05-whatsapp-core-handoff.test.ts`
- `tests/providers/e05-whatsapp-provider-receipt-store.test.ts`
- `tests/providers/runtime-outage-e05-whatsapp-core-handoff-harness.ts`
- `docs/execution/receipts/v1-int4-worker-2.md`

No Core repositories, Product/UI, shared E05 contracts, migrations, package files, lockfiles, connector retry persistence, new provider families, or live provider credentials were touched.

## Outage harness proof

Materialized the exact changed behavior under `/mnt/data/sd-int4b` and executed:

```bash
cd /mnt/data/sd-int4b && ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/providers/runtime-outage-e05-whatsapp-core-handoff-harness.ts
```

Result:

```text
runtime-outage-e05-whatsapp-core-handoff-harness PASS
```

Harness coverage:
- Unix seconds → ISO conversion
- Unix milliseconds → ISO conversion
- valid ISO normalization
- invalid timestamp fail-closed
- technical receipt field minimization
- Supabase-style `INSERTED` / `DUPLICATE`
- duplicate identity conflict fail-closed
- retry after Core failure
- later Core duplicate ACK
- invalid signature no receipt/Core call
- `CUSTOMER_REPLY` WhatsApp success
- `CUSTOMER_REPLY` Email success
- opt-out suppression
- handover-safe staff reply
- delivery-state monotonic/terminal behavior
- no raw body, secret, untrusted payload body, recipient PII, or duplicated text leakage in connector-facing results

## Canonical tests authored but not executed

- `tests/providers/e05-whatsapp-timestamp-normalization.test.ts`
- `tests/providers/e05-whatsapp-provider-receipt-store.test.ts`
- `tests/providers/e05-whatsapp-core-handoff.test.ts`
- Existing INT4 canonical tests remain:
  - `tests/providers/e05-conversation-reply-intent.test.ts`
  - `tests/providers/e05-whatsapp-delivery-state-bridge.test.ts`

Required catch-up when Runtime package/network access returns:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/providers/e05-whatsapp-timestamp-normalization.test.ts tests/providers/e05-whatsapp-provider-receipt-store.test.ts tests/providers/e05-whatsapp-core-handoff.test.ts tests/providers/e05-conversation-reply-intent.test.ts tests/providers/e05-whatsapp-delivery-state-bridge.test.ts
pnpm vitest run tests/providers
pnpm vitest run tests/ai
pnpm typecheck
```

## Blockers

- `BLOCKED_RUNTIME_GIT_DNS`: GPT Runtime normal Git transport cannot resolve `github.com`.
- `BLOCKED_RUNTIME_PACKAGE_ACCESS`: `pnpm` unavailable; Corepack cannot fetch package manager from npm registry.
- `BLOCKED_ON_CORE_0008`: staging project `cpmmgivhlkfbiwzhlcey` does not yet contain `public.provider_inbound_receipts`, so real staging insert/duplicate proof cannot run without creating a competing schema.

## Next task

`E06 calendar/crew transition bridge`
