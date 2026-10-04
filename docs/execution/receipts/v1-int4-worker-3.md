# ServiceDesk AI — Worker 3 V1-INT4 / INT4B Receipt

WORKER: 3
SPRINT: V1-INT4B
BRANCH: `feat/servicedesk-v1-product-sprint3`
START_SHA: `e54104b4459dde19c109393ad39e640a0adb7855`
STATE: `IMPLEMENTED`
CANONICAL_GATE: `CONFIGURATION_BLOCKED`
CORE_CONTRACT_ALIGNMENT: `PASS`
ROUTE_COVERAGE: `PASS`

## INT4B packet
User-requested recovery/reconciliation against coordinator ref `184331936ba6c81a1d216c7d866d8b62bd2c5b10`.

Primary mission:
Remove Product-side shadow E05 contracts and match the frozen Core facade exactly.

## Branch verification
- Remote branch: `feat/servicedesk-v1-product-sprint3`.
- Expected current HEAD: `e54104b4459dde19c109393ad39e640a0adb7855`.
- Observed current HEAD before INT4B writes: `e54104b4459dde19c109393ad39e640a0adb7855`.
- No newer Product sprint3 work was overwritten.

## Frozen E05 facade alignment
The branch-local frozen Core facade exposes:

```ts
readWorkspaceSnapshot(ctx, query)
setConversationHandover(ctx, conversationId, input, meta)
enqueueConversationReply(ctx, conversationId, input, meta)
```

and Core E05 types:

```ts
WorkspaceSnapshot
WorkspaceSnapshotQuery
ConversationHandoverInput
ConversationReplyInput
ConversationReplyOutcome
```

INT4B updates Product to type-import these from `@/server/core/facade` and to use `ActorContext`, `CommandMeta`, `ConversationDTO`, and `MessageDTO` from shared contracts. Product no longer declares a local `WorkspaceSnapshot` business-truth shape.

## Completed INT4B work
- Removed Product-side `WorkspaceSnapshot` shadow interface from `src/features/inbox/server-boundary.ts`.
- Removed Product-invented `workspaceId` and `customers` fields from inbox snapshot mapping assumptions.
- Changed inbox command port to structurally match the Core facade:
  - `readWorkspaceSnapshot(ctx, query)`
  - `setConversationHandover(ctx, conversationId, input, meta)`
  - `enqueueConversationReply(ctx, conversationId, input, meta)`
- Fixed reply modeling from `MessageDTO` to `ConversationReplyOutcome`.
- Preserved `ConversationReplyOutcome.message` for UI consumption and retained `outboxEventId` in the Product action result.
- Changed workspace validation to use `ActorContext.workspaceId` as the authoritative requested workspace.
- Preserved fail-closed behavior for:
  - selected conversation absent;
  - conversation workspace mismatch;
  - message workspace mismatch;
  - selected request workspace mismatch.
- Changed broad snapshot handling so unrelated same-workspace messages are allowed and selected thread messages are filtered by `conversationId`.
- Handover adapter now passes:
  - current `ActorContext`;
  - `conversation.id`;
  - `{ active, assignedUserId? }`;
  - `CommandMeta` with `expectedVersion` from current `ConversationDTO.version`.
- Reply adapter now passes:
  - current `ActorContext`;
  - `conversation.id`;
  - `{ body, channel }`;
  - `CommandMeta` with current `expectedVersion` and caller idempotency key.
- Route-local inbox helper now maps Core `WorkspaceSnapshot` with explicit `workspaceId`/actor workspace supplied by the route boundary.
- OperationalRoute coverage was not shrunk.

## Package-free executable evidence
Executed in GPT Runtime scratch space:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","jsx":"react"}' ts-node --transpile-only tests/e2e/runtime-outage-e05-inbox-product-boundary-harness.ts
```

Observed:

```text
runtime-outage-e05-inbox-product-boundary-harness PASS
```

The updated harness proves:
- no local shadow `WorkspaceSnapshot` in Product;
- exact Core command signatures are represented in the Product command port;
- `ConversationReplyOutcome` is preserved;
- broad workspace snapshots filter the selected thread correctly;
- cross-workspace conversation/message data is rejected;
- current `ConversationDTO.version` is propagated as `CommandMeta.expectedVersion`;
- handover/reply do not optimistically mutate local truth before server success;
- reusable inbox remains fixture-free;
- fixture wrapper owns demo data;
- existing route families remain represented;
- Product inbox boundary files import no Core repositories and no provider adapters.

## Canonical tests updated
Updated:
- `tests/e2e/runtime-outage-e05-inbox-product-boundary-harness.ts`
- `tests/e2e/product-inbox-server-boundary.test.ts`

Canonical tests are authored but not run through Vitest because `pnpm` remains unavailable in GPT Runtime.

## Changed paths in INT4B
- `src/features/inbox/server-boundary.ts`
- `src/app/app/[workspace]/inbox/server-actions.ts`
- `tests/e2e/runtime-outage-e05-inbox-product-boundary-harness.ts`
- `tests/e2e/product-inbox-server-boundary.test.ts`
- `docs/execution/receipts/v1-int4-worker-3.md`

## Canonical gate blockers
- `pnpm` unavailable in GPT Runtime.
- GitHub DNS fails from Runtime Git transport.
- Corepack cannot fetch `pnpm@10.17.1` from npm registry.
- Canonical Vitest/typecheck/lint/build/browser checks cannot run until package/network access returns.

## Not claimed
- No `CONTRACT_TESTED` claim.
- No browser/runtime Product acceptance claim.
- No provider verification claim.
- No E06 crew transition Product wiring.

## Ready next
`E06 crew visit transition Product wiring`
