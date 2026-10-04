# V1 Integration Sprint 4 — Worker 3 / Server-Backed Inbox Product

Branch: `feat/servicedesk-v1-product-sprint3`
Exact base: `602e581c1df860480c230da893128c0d1b8ca395`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

Use the coordinator-frozen E05 types:
- `MessageDTO`
- `ConversationDTO`
- `WorkspaceSnapshot`
- `setConversationHandover`
- `enqueueConversationReply`

Do not add pages or visual polish. This is data/action boundary work.

## Mission
Convert the existing shared inbox Product surface from internal fixture ownership to a typed server-snapshot/action boundary while preserving an explicit fixture wrapper for demos until Core E05 is integrated.

One normal Runtime recovery probe only. During outage mode use source/static harnesses.

## INT4-W3-T1 — Inbox props/view-model boundary

Refactor:
- `src/features/inbox/InboxPreview.tsx`
- `src/features/inbox/view-models.ts`

Reusable inbox must consume:
- selected ConversationDTO;
- MessageDTO[];
- customer/request labels supplied by route data;
- action availability/state supplied as props.

Remove local sampleMessages/sampleThread ownership from reusable InboxPreview.

Map durable MessageDTO delivery states truthfully:
- inbound always received/neutral;
- QUEUED/RUNNING/PROVIDER_ACCEPTED pending;
- DELIVERED/READ success;
- FAILED/SUPPRESSED failure/attention.

Do not imply provider acceptance == delivery.

## INT4-W3-T2 — Explicit inbox fixture wrapper

Add:
- `src/features/inbox/InboxFixturePreview.tsx`

This wrapper may own fixture conversation/messages and must clearly label fixture/demo state.

OperationalFixtureRoute may use it.

Reusable InboxPreview must not import sample data.

## INT4-W3-T3 — Route data + snapshot mapping

Extend Product route data with a typed staff inbox snapshot:
- conversation;
- messages;
- customerLabel;
- requestLabel.

Add pure mapper from coordinator-frozen `WorkspaceSnapshot` + selected conversation to inbox route data.

Fail closed when:
- selected conversation is outside snapshot;
- message conversationId mismatches;
- workspace IDs differ.

Do not fabricate missing conversations/messages.

## INT4-W3-T4 — Inbox server-action adapters

Add dependency-injected Product adapters for:
- readWorkspaceSnapshot;
- setConversationHandover;
- enqueueConversationReply.

No Core repository imports.
No provider adapters.

Handover action must pass expectedVersion from the current ConversationDTO.
Reply action must pass current conversation/version and exact server command result through Product action-state mapping.

## INT4-W3-T5 — Action states

Extend Product action states for:
- conversation not found;
- message/reply validation failure;
- handover VERSION_CONFLICT;
- recipient/consent blocked;
- outbound enqueue failure;
- snapshot authorization failure.

No optimistic local handover or message insertion before server success.

## INT4-W3-T6 — OperationalRoute inbox integration

Update reusable OperationalRoute staff inbox panel to render props-driven InboxPreview when inbox data is present.

Fixture pages remain routed through OperationalFixtureRoute until E05 Core acceptance.

Preserve all other route/module coverage from INT2 recovery.

## INT4-W3-T7 — Future real route boundary

Add a route-local dependency-injected loader/action factory for:
- `src/app/app/[workspace]/inbox/`

It should be capable of:
1. readWorkspaceSnapshot;
2. select conversation from query/route input;
3. build inbox view data;
4. submit handover/reply commands.

Do not instantiate server repositories or provider clients.
Do not switch the production/demo page to live server composition yet.

## INT4-W3-T8 — Package-free harness + canonical tests

Add:
`tests/e2e/runtime-outage-e05-inbox-product-boundary-harness.ts`

Prove:
- reusable InboxPreview has no local sample messages;
- InboxFixturePreview owns fixture data;
- WorkspaceSnapshot mapper rejects cross-workspace/mismatched message data;
- handover passes current expectedVersion;
- reply delegates exactly once;
- failed server action does not optimistically alter local truth;
- OperationalRoute retains prior business/customer/staff/crew module coverage;
- Product imports no provider adapters/Core repositories.

Author focused canonical Product tests.

## Restrictions
- hosted checkout remains sandbox/demo until integrated runtime;
- crew mutations remain disabled until E06;
- no new page family;
- no cosmetic redesign.

## Receipt
`docs/execution/receipts/v1-int4-worker-3.md`

Return:
WORKER=3
SPRINT=V1-INT4
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E06 crew visit transition Product wiring
