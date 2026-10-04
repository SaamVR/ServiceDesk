# V1 Integration Sprint 2 — Worker 3 / Central Product Server Boundary

Branch: `feat/servicedesk-v1-product-sprint2`
Exact base: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/v1-integration-sprint-20261004.md`
- `docs/execution/provider-access-policy-20261004.md`
- this packet

One normal Runtime recovery probe only. During outage mode, do not rely on React/Next/browser execution.

## Mission
Remove the largest remaining fixture entanglement from the Product surface and build server-action adapters against the accepted E02 command entrypoints.

Do not add new pages or cosmetic features.

## Required slices

### INT2-W3-T1 — Central operational data bundle
Add a Product-owned typed route data model, suggested:
- `src/features/operations/route-data.ts`

Bundle the current accepted DTO data used by OperationalRoute:
- request
- quote
- slot
- visit
- invoice
- conversation
- integrations
- attentionItems
plus optional previousQuote/properties where useful.

No server repository/provider types.

### INT2-W3-T2 — Remove sample-data ownership from OperationalRoute
Refactor:
- `src/features/operations/OperationalRoute.tsx`

The reusable operational route must consume the typed data bundle through props and must no longer import `sample-data`.

Preserve current business/customer/staff/crew rendering semantics.

Use the INT1 props-driven Quote/Schedule/Checkout/Invoice/CRM/Crew components directly with supplied data.

### INT2-W3-T3 — Explicit fixture route wrapper
Add:
- `src/features/operations/OperationalFixtureRoute.tsx`

This wrapper alone may import sample-data and pass the fixture bundle into `OperationalRoute`.

Update current showcase/demo route pages to import/use `OperationalFixtureRoute` so the project remains source-compatible while real server snapshots are not composed.

Do not hide fixture state: keep current fixture/sandbox labels.

### INT2-W3-T4 — Enquiry server-action adapter
Add a route-owned, dependency-injected pure server action factory under:
- `src/app/b/[slug]/enquire/`

It may import the accepted Core server-entrypoint TYPES/shape from server code because it is route/server-side code, but it must not instantiate repositories.

Given injected commands + ActorContext + CommandMeta + validated form values, orchestrate:
1. createRequestCommand with service/customer/property;
2. updateRequestCommand with bedrooms/bathrooms/requestedStartAt and expected version;
3. calculateQuoteCommand;
4. return serializable authoritative RequestDTO + QuoteDTO or exact Result error.

No client-side price calculation.

### INT2-W3-T5 — Quote/schedule server-action adapters
Add dependency-injected route/server adapters for:
- sendQuoteCommand;
- findSlotsCommand;
- holdSlotCommand.

They must pass through exact Result/errors and never call providers directly.

No hosted checkout call yet; E03 payment bridge is still in progress.

### INT2-W3-T6 — Product action state/view contracts
Add pure action-state mapping so Product can display:
- success authoritative DTO;
- VERSION_CONFLICT;
- authorization/workspace/visitor failure;
- quote/slot not found;
- hold expiry/failure;
without optimistic local mutation.

Keep unsupported actions disabled in fixture routes.

### INT2-W3-T7 — Static server-boundary harness
Add:
`tests/e2e/runtime-outage-product-server-boundary-harness.ts`

Package-free assertions must prove:
- OperationalRoute no longer imports sample-data;
- OperationalFixtureRoute owns fixture import;
- current pages explicitly use fixture wrapper until real runtime composition exists;
- action factories import no provider adapters;
- enquiry orchestration calls create -> update -> calculate in order and propagates failure without later calls;
- quote/schedule adapters delegate exactly once;
- no Product file imports Core repositories.

### INT2-W3-T8 — Canonical tests
Author focused Product tests for route-data and server-action orchestration.
If pnpm recovers, run Product suite/typecheck/lint/build.

## Continue rule
Complete all independent slices. Do not stop after central route refactor.

## Receipt
`docs/execution/receipts/v1-int2-worker-3.md`

Return:
WORKER=3
SPRINT=V1-INT2
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
COMPLETED=<slice ids>
BLOCKERS=<exact blockers>
READY_NEXT=replace fixture route wrapper with real readWorkspaceSnapshot/runtime composition after E03/E05
