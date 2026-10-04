# V1 Integration Sprint 1 — Worker 1 / Authoritative Core

Branch: `feat/servicedesk-v1-core-sprint1`
Exact base: `714f24edfe7c6124237c7259a00ede7b288b68fb`
RC lineage: `rc/servicedesk-v1-unverified-20261004`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- this packet

## Mission
Close the missing E02 authoritative server composition. This run is not for isolated hardening. Build the reusable server boundary that lets Product stop using fixture business truth.

Make one normal Runtime recovery probe only. If canonical package access is blocked, continue package-free under outage mode.

Do not edit `src/contracts/**`; `PropertyDTO` is already coordinator-approved in the sprint base.

## Required slices

### INT1-W1-T1 — Property persistence adapter
Add Core-owned property persistence/read modules based on the existing `public.properties` schema:
- `src/server/core/property-repository.ts`
- `src/server/core/property-read.ts`

Required behavior:
- workspace-scoped property reads only;
- customerId scoped;
- archived properties excluded by repository contract;
- row → `PropertyDTO` mapping preserves optional label/address2/region/serviceNotes/accessNotes/version;
- returned rows with wrong workspace/customer fail closed.

Approved read:
`readPropertySnapshot(ctx, customerId): Promise<Result<PropertyDTO[]>>`

OWNER/DISPATCHER may read same-workspace customer properties. VISITOR access must not be invented.

### INT1-W1-T2 — Request facade
Add:
- `src/server/core/request-facade.ts`

Create `createRequestFacadeMethods(deps)` implementing:
- `ServiceDeskFacade.createRequest`
- `ServiceDeskFacade.updateRequest`

Use existing request repository/guards. Map `RequestRecord` ↔ `RequestDTO`. Do not bypass visitor-session, workspace, role or expectedVersion semantics.

The current `CreateRequestInput` is narrower than the domain input; support exactly the accepted facade fields and do not invent client-side pricing.

### INT1-W1-T3 — Request + Quote + Capacity composition
Add:
- `src/server/core/request-quote-facade.ts`

Compose existing:
- request facade methods;
- `createQuoteFacadeMethods`;
- `createCapacityFacadeMethods`.

Return a typed Pick of the existing `ServiceDeskFacade` covering:
createRequest/updateRequest/calculateQuote/sendQuote/findSlots/holdSlot.

No provider/database singleton. Dependencies are injected.

### INT1-W1-T4 — Server-only command entrypoint factory
Add:
- `src/server/core/server-entrypoints.ts`

Expose an injected factory/bound command object suitable for route/server-action consumption without Product importing repositories directly.

At minimum expose:
- createRequestCommand
- updateRequestCommand
- calculateQuoteCommand
- sendQuoteCommand
- findSlotsCommand
- holdSlotCommand
- readPropertySnapshotCommand

Do not fabricate `applyVerifiedPayment`, `transitionVisit`, or `readWorkspaceSnapshot` implementations here.

### INT1-W1-T5 — Package-free end-to-end Core harness
Add:
- `tests/db/runtime-outage-e02-server-composition-harness.ts`

Using in-memory repositories and exact real modules, execute:
1. visitor creates its own request;
2. visitor updates rooms/service;
3. quote is calculated from persisted request;
4. authorized staff sends an approved quote;
5. availability is read from same workspace;
6. staff holds a valid slot;
7. property read returns same-workspace rows;
8. wrong visitor/workspace/version is rejected.

Run with global ts-node under GPT Runtime.

### INT1-W1-T6 — Canonical tests
Add focused canonical tests for:
- property read;
- request facade;
- request→quote composition;
- server entrypoint delegation/authority boundary.

If pnpm recovers, run them plus domain/db/typecheck.

## Continue-until rule
Do not return after one module. Complete T1–T6 unless a genuine blocker prevents all remaining slices. If blocked on one slice, continue every independent slice.

## Output
Use 2–3 implementation commits plus compact receipt:
`docs/execution/receipts/v1-int1-worker-1.md`

Return:
WORKER=1
SPRINT=V1-INT1
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=E03 atomic verified payment core boundary
