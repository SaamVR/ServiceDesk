# V1 Integration Sprint 4 — Worker 1 / Authoritative Inbox + Handover Core

Branch: `feat/servicedesk-v1-core-sprint4`
Exact base: `602e581c1df860480c230da893128c0d1b8ca395`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

Coordinator-frozen E05 contracts already exist in:
- `src/contracts/dtos.ts` — `MessageDTO`
- `src/server/core/facade.ts` — inbound message, handover, reply, workspace snapshot

Do not modify shared contracts unless an actual compile-blocking defect is found; report it instead.

## Mission
Close V1 E05 Core: provider inbound -> durable conversation/message truth, human handover, business-authorized outbound enqueue, and typed inbox/workspace snapshot reads.

One normal Runtime recovery probe only. If canonical tooling remains blocked, continue under outage mode.

## INT4-W1-T1 — Conversation/inbox runtime migration

Add:
`supabase/migrations/0008_conversation_inbox_runtime.sql`

Extend current `conversations` / `messages` schema without replacing migration 0001.

Required:
- unique stable provider thread identity per workspace/channel when provider_thread_id is present;
- message `provider_receipt_key` for provider/business idempotency;
- provider account/timestamp metadata;
- inbound content kind;
- media reference JSON only, never raw provider media bytes;
- raw provider event REF only, never raw provider payload;
- outbound message idempotency key;
- optional outbox_event_id linkage;
- delivery_state supporting QUEUED/RUNNING/PROVIDER_ACCEPTED/DELIVERED/READ/FAILED/SUPPRESSED;
- indexes for conversation last-message ordering and provider receipt lookup.

Add server-only technical table:
`provider_inbound_receipts`

Persist:
- workspace/provider/provider account/provider message/receipt key;
- rawProviderEventRef;
- content kind;
- received/processed timestamps/state.

Unique receipt identity must be durable.

Security:
- provider receipt writes are service-role/trusted-server only;
- drop/replace direct authenticated `conversations_staff_all` mutation policy so staff read is allowed but command mutation goes through trusted server Core;
- keep staff/customer conversation reads appropriately scoped;
- add customer message read policy through owned conversation/customer;
- no anonymous direct insert/update policy.

## INT4-W1-T2 — Conversation/message domain + repository

Add Core-owned modules, suggested:
- `src/domain/conversations.ts`
- `src/server/core/conversation-repository.ts`

Model:
- ConversationRecord including internal handoverOwnerRevision;
- MessageRecord including provider receipt/idempotency/delivery metadata;
- workspace/customer/contact/thread lookup;
- transaction/unit-of-work boundary for conversation + message + outbox changes.

Repository must fail closed on returned workspace/id/thread mismatches.

## INT4-W1-T3 — Authoritative inbound application

Add:
- `src/server/core/inbound-message.ts`
- facade composition for `applyInboundMessage`.

Rules:
- validate nonblank receipt/provider/message/sender identities and valid occurredAt;
- only TEXT/MEDIA_REFERENCE are business-processable;
- duplicate providerReceiptKey/providerMessageId => `DUPLICATE`, zero second message/version mutation;
- derive stable WHATSAPP provider thread identity from server-normalized provider account + sender reference;
- find existing same-workspace thread or create one;
- optionally attach exact known customer by PHONE contact; unknown sender may remain unattached rather than guessing;
- optionally attach request only when repository can resolve one unambiguous active request; otherwise leave requestId unset;
- persist inbound message;
- bump conversation version/lastMessageAt exactly once;
- preserve current handover state;
- return `InboundMessageApplicationOutcome`.

No AI action and no provider call from Core.

## INT4-W1-T4 — Human handover command

Implement `setConversationHandover`.

Authorization:
- OWNER or DISPATCHER only;
- verified staff userId required;
- same workspace;
- `meta.expectedVersion` required and exact.

Semantics:
- activate => assigned user is explicit authorized OWNER/DISPATCHER or current actor;
- deactivate => clear active handover and assignment;
- increment conversation version;
- increment handover_owner_revision whenever ownership/handover state changes;
- stale version => VERSION_CONFLICT;
- cross-workspace / unauthorized assignment => fail closed.

## INT4-W1-T5 — Business-authorized staff reply

Implement `enqueueConversationReply`.

Rules:
- OWNER/DISPATCHER only;
- same workspace;
- expectedVersion required;
- body nonblank and bounded;
- channel must match/support conversation channel;
- resolve recipient from authoritative customer contact;
- enforce communication consent/opt-out before enqueue;
- human staff reply remains allowed while human handover is active;
- create OUTBOUND STAFF message with deliveryState QUEUED;
- enqueue exactly one outbox event with topic `conversation.reply`;
- outbox payload should carry authoritative identifiers (conversationId/messageId/channel), not provider secrets;
- message/outbox creation must be one transaction;
- workspace + meta.idempotencyKey duplicate => return prior result without second message/outbox.

Do not call provider directly.

## INT4-W1-T6 — Workspace/inbox snapshot read

Implement `readWorkspaceSnapshot` with conversations/messages in addition to current request/quote/visit/invoice arrays.

Authorization:
- OWNER/DISPATCHER: workspace-scoped staff read;
- CUSTOMER: only records attached to their authenticated customer identity;
- VISITOR/unauthorized roles: fail closed;
- do not broaden CREW private inbox visibility in E05.

Support conversationId/customerId/requestId filters without crossing workspace boundaries.

Messages returned only for conversations already authorized in the snapshot.

## INT4-W1-T7 — Server composition

Extend server entrypoints/facade composition with injected:
- applyInboundMessageCommand
- setConversationHandoverCommand
- enqueueConversationReplyCommand
- readWorkspaceSnapshotCommand

No Connector imports.

## INT4-W1-T8 — Package-free E05 harness + canonical tests

Add:
`tests/db/runtime-outage-e05-inbox-handover-harness.ts`

Cover:
- first inbound creates conversation/message;
- retry receipt => DUPLICATE and no version bump;
- unknown sender safely persists unattached conversation;
- handover activation/deactivation/version conflict;
- unauthorized/cross-workspace handover rejected;
- staff reply creates message + outbox once;
- handover-active human reply remains allowed;
- opt-out/no recipient fails before outbox;
- transaction failure rolls back message/outbox;
- staff snapshot includes authorized conversations/messages;
- customer snapshot cannot see another customer;
- visitor snapshot denied.

Author migration/repository/facade/read tests.

If source is complete and only real Postgres/RLS/transaction proof remains, report:
`SUPABASE_STAGING_REQUIRED_FOR_E05_DB_PROOF`.

## Receipt
`docs/execution/receipts/v1-int4-worker-1.md`

Return:
WORKER=1
SPRINT=V1-INT4
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E06 crew transitions and field evidence
