# ServiceDesk AI — Worker 3 V1-INT5 Receipt

WORKER: 3
SPRINT: V1-INT5
BRANCH: `feat/servicedesk-v1-product-sprint4`
START_SHA: `58d4121fbb39e5f82ac2986def1ed0dc4a729faf`
STATE: `IMPLEMENTED`
CANONICAL_GATE: `CONFIGURATION_BLOCKED`
CREW_TRANSITION_WIRING: `PASS`
FIELD_EVIDENCE_BOUNDARY: `PASS`
ROUTE_COVERAGE: `PASS`

## Scope

Primary mission: wire the existing crew Product experience to the frozen Core `transitionVisit(ctx, visitId, action, meta)` command without inventing persisted field-evidence business truth.

The sprint did not add a new page family and did not redesign the crew UI.

## Branch verification

- Branch `feat/servicedesk-v1-product-sprint4` existed before writing.
- Observed head matched exact requested starting head: `58d4121fbb39e5f82ac2986def1ed0dc4a729faf`.
- Work was preserved and written on top of that head.

## Implemented

- Added `src/features/crew/server-boundary.ts`
  - Uses type-only Core facade contract.
  - Port is `ServiceDeskFacade["transitionVisit"]`.
  - Calls `transitionVisit(ctx, visit.id, action, meta)` exactly.
  - Propagates `CommandMeta.expectedVersion = visit.version`.
  - Uses route-supplied `idempotencyKey` and `now`.
  - Does not optimistically mutate local `VisitDTO`.

- Added conservative crew action mapping:
  - `ASSIGNED -> EN_ROUTE`
  - `EN_ROUTE -> START`
  - `IN_PROGRESS -> SUBMIT_REVIEW`
  - `CONFIRM`, `ASSIGN`, `COMPLETE`, and `CANCEL` remain unavailable to Product crew users.

- Updated `src/features/crew/CrewJobPreview.tsx`
  - Accepts optional transition presentation state.
  - Enables only a supplied valid server-action transition.
  - Fixture/demo route remains labelled `FIXTURE_UI_ONLY / NOT_MUTATED`.

- Added `src/features/crew/field-evidence-boundary.ts`
  - Defines Product-only field evidence UI needs:
    - before photo slot
    - after photo slot
    - optional issue photo
    - time/material note
    - incident note
  - Persistence is explicitly `FUTURE_E06_CORE_EVIDENCE`.
  - Submit is disabled until Core freezes and implements a persisted evidence command.

- Updated `src/features/crew/view-models.ts`
  - Removed fake checklist completion as business truth.
  - Checklist and evidence are labelled `NOT_PERSISTED`.
  - No evidence completion is inferred from `VisitDTO.status`.

- Added route-local injected boundaries:
  - `src/app/crew/today/server-actions.ts`
  - `src/app/crew/jobs/[id]/server-actions.ts`
  - These prepare existing crew routes for injected authoritative snapshots and `transitionVisit` without repositories/providers.

- Extended action-state handling:
  - unauthorized crew
  - visit not found
  - wrong workspace
  - invalid transition
  - version conflict
  - review required
  - server failure fallback

- Updated `src/features/operations/route-data.ts`
  - Allows optional crew transition presentation data without changing route coverage.

## Package-free executable evidence

Executed in GPT Runtime scratch space:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' ts-node --transpile-only tests/e2e/runtime-outage-e06-crew-product-boundary-harness.ts
```

Observed:

```text
runtime-outage-e06-crew-product-boundary-harness PASS
```

The harness proves:

- exact `transitionVisit(ctx, visitId, action, meta)` source boundary;
- `expectedVersion` comes from current `VisitDTO.version`;
- `ASSIGNED -> EN_ROUTE`;
- `EN_ROUTE -> START`;
- `IN_PROGRESS -> SUBMIT_REVIEW`;
- forbidden Product actions remain unavailable;
- no optimistic mutation in the adapter;
- field evidence remains explicitly non-persisted;
- no provider adapter or Core repository imports;
- previous business/customer/staff/inbox/crew/onboarding/tour coverage strings remain represented.

## Canonical tests authored

- `tests/e2e/product-crew-transition-boundary.test.ts`
- `tests/e2e/runtime-outage-e06-crew-product-boundary-harness.ts`

## Not run / canonical gate

Not run due GPT Runtime package/network outage:

```bash
pnpm test tests/e2e/product-crew-transition-boundary.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Therefore proof remains `IMPLEMENTED`, not `CONTRACT_TESTED`.

## Blockers

- `pnpm` unavailable in GPT Runtime.
- GitHub DNS fails from Runtime Git transport.
- Corepack cannot fetch `pnpm@10.17.1` from npm registry.
- Canonical Vitest/typecheck/lint/build/browser checks cannot run until package/network access returns.
- Persisted field evidence remains blocked until Core E06 freezes a persistence command.

## Ready next

`enable persisted field evidence after Core E06 contract`
