# ServiceDesk AI — V1-INT4 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT4  
Branch: `feat/servicedesk-v1-core-sprint4`  
Coordinator ref: `9ce12193caf3d2104168931b28efeeaf22a9d531`

## Start / final SHA

- Exact required sprint base: `602e581c1df860480c230da893128c0d1b8ca395`
- Observed starting branch HEAD: `602e581c1df860480c230da893128c0d1b8ca395`
- Final implementation SHA before this receipt: `074d1477588613f34c6eb80115f4e2d0388b266d`
- Final SHA after this receipt: recorded by GitHub commit containing this file

## Runtime probe

Single normal recovery probe only:

```text
node --version => v22.16.0
npm --version => 10.9.2
corepack --version => 0.32.0
pnpm --version => bash: pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint4 => Could not resolve host: github.com
ts-node --version => v10.9.2
```

Canonical pnpm/Git access remained unavailable, so this sprint entered Runtime Outage Mode.

## Completed slices

### INT4-W1-T1 — Conversation/inbox runtime migration

State: IMPLEMENTED

Added:
- `supabase/migrations/0008_conversation_inbox_runtime.sql`

Behavior covered in source:
- provider thread identity uniqueness per workspace/channel;
- provider receipt keys on messages;
- provider account/timestamp metadata;
- content kind and media reference metadata without raw media bytes;
- raw provider event reference only;
- outbound idempotency key and outbox event linkage;
- delivery state lifecycle fields;
- `provider_inbound_receipts` trusted-server table;
- staff/customer read policies and no anonymous/direct mutation policy for provider receipts.

### INT4-W1-T2 — Conversation/message domain + repository

State: IMPLEMENTED

Added:
- `src/domain/conversations.ts`
- `src/server/core/conversation-repository.ts`

Behavior:
- typed conversation, message, receipt, contact, active request and reply outbox records;
- DTO mapping that does not expose internal receipt/idempotency fields;
- stable provider thread identity derivation;
- transaction/unit-of-work repository port for conversation/message/outbox mutations;
- workspace fail-closed helper for returned conversation rows.

### INT4-W1-T3 — Authoritative inbound application

State: IMPLEMENTED

Added:
- `src/server/core/inbound-message.ts`

Behavior:
- validates receipt/provider/message/sender/timestamp/content before mutation;
- duplicate provider receipt/message returns `DUPLICATE` without second message/version mutation;
- same-workspace provider thread lookup/create;
- customer attachment by exact contact;
- active request attachment only when repository resolves one unambiguous active request;
- unknown sender persists unattached conversation;
- inbound message persistence and exactly one conversation version/lastMessageAt bump;
- no AI/provider call from Core.

### INT4-W1-T4 — Human handover command

State: IMPLEMENTED

Behavior:
- OWNER/DISPATCHER + userId required;
- expectedVersion required and exact;
- assignment is current actor or explicit repository-authorized staff;
- deactivate clears active handover/assignment;
- version and handoverOwnerRevision increment on state change;
- stale/cross-workspace/unauthorized assignment fail closed.

### INT4-W1-T5 — Business-authorized staff reply

State: IMPLEMENTED

Behavior:
- OWNER/DISPATCHER + expectedVersion required;
- nonblank bounded body;
- channel must match conversation channel;
- recipient resolved from authoritative customer contact;
- consent/opt-out enforced before outbox;
- creates OUTBOUND STAFF message with `QUEUED` delivery state;
- enqueues exactly one `conversation.reply` outbox event with authoritative IDs only;
- workspace+idempotency duplicate returns prior result without second message/outbox;
- message/outbox/conversation update occur inside one repository transaction.

### INT4-W1-T6 — Workspace/inbox snapshot read

State: IMPLEMENTED

Behavior:
- OWNER/DISPATCHER workspace-scoped staff snapshot;
- CUSTOMER scoped to their resolved customer identity;
- VISITOR/CREW denied;
- conversationId/customerId/requestId filters without crossing workspace boundary;
- messages returned only for authorized conversations.

### INT4-W1-T7 — Server composition

State: IMPLEMENTED

Updated:
- `src/server/core/server-entrypoints.ts`

Added command entrypoints:
- `applyInboundMessageCommand`
- `setConversationHandoverCommand`
- `enqueueConversationReplyCommand`
- `readWorkspaceSnapshotCommand`

No Connector imports or provider calls were added to Core.

### INT4-W1-T8 — Package-free harness + canonical tests

State: IMPLEMENTED / AUTHORED_NOT_CANONICALLY_EXECUTED

Added:
- `tests/db/runtime-outage-e05-inbox-handover-harness.ts`
- `tests/db/conversation-repository.test.ts`
- `tests/db/inbound-message-facade.test.ts`
- `tests/db/conversation-handover-reply.test.ts`
- `tests/db/conversation-snapshot.test.ts`
- `tests/db/conversation-migration-structure.test.ts`

Package-free Runtime command executed in `/mnt/data/sd-e05`:

```bash
ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/db/runtime-outage-e05-inbox-handover-harness.ts
```

Result:

```text
runtime-outage e05 inbox handover harness PASS
```

Harness coverage:
- first inbound creates conversation/message;
- retry receipt returns DUPLICATE with no version bump;
- unknown sender persists unattached conversation;
- handover activation/deactivation/version conflict;
- unauthorized/cross-workspace handover rejected;
- staff reply creates message + outbox once;
- handover-active human reply remains allowed;
- opt-out fails before outbox;
- transaction failure rolls back message/outbox;
- staff snapshot includes authorized conversations/messages;
- customer snapshot cannot see another customer;
- visitor snapshot denied.

## Changed files

- `supabase/migrations/0008_conversation_inbox_runtime.sql`
- `src/domain/conversations.ts`
- `src/server/core/conversation-repository.ts`
- `src/server/core/inbound-message.ts`
- `src/server/core/server-entrypoints.ts`
- `tests/db/runtime-outage-e05-inbox-handover-harness.ts`
- `tests/db/conversation-repository.test.ts`
- `tests/db/inbound-message-facade.test.ts`
- `tests/db/conversation-handover-reply.test.ts`
- `tests/db/conversation-snapshot.test.ts`
- `tests/db/conversation-migration-structure.test.ts`
- `docs/execution/receipts/v1-int4-worker-1.md`

## Proof level

- Outage harness: PASS
- Source implementation state: IMPLEMENTED
- Canonical pnpm install: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Canonical Vitest: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Typecheck: NOT_EXECUTED / CONFIGURATION_BLOCKED
- DB/RLS proof: NOT_EXECUTED
- Provider proof: N/A

## Blockers

```text
pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint4 => Could not resolve host: github.com
SUPABASE_STAGING_REQUIRED_FOR_E05_DB_PROOF
```

## Next

READY_NEXT=E06 crew transitions and field evidence

When canonical access returns, run:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/db/runtime-outage-e05-inbox-handover-harness.ts tests/db/conversation-repository.test.ts tests/db/inbound-message-facade.test.ts tests/db/conversation-handover-reply.test.ts tests/db/conversation-snapshot.test.ts tests/db/conversation-migration-structure.test.ts
pnpm test:db
pnpm typecheck
```

When Supabase staging is available, run real PostgreSQL/RLS/transaction proof for receipt identity, conversation/customer read policies, handover versioning, reply idempotency, and message+outbox rollback.
