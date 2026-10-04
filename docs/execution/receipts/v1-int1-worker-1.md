# ServiceDesk AI — V1-INT1 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT1  
Branch: `feat/servicedesk-v1-core-sprint1`  
Coordinator ref: `65f4ed196acc481d1c7657ae48f80ed57e74d8ae`

## Start / final SHA

- Exact required sprint base: `714f24edfe7c6124237c7259a00ede7b288b68fb`
- Observed starting branch HEAD: `714f24edfe7c6124237c7259a00ede7b288b68fb`
- Implementation commits:
  - `cb3beea609b4e6e2557bad963879b667b7778f99` — E02 Core modules
  - `792f8751f1ad2193e46a19af297e7af2a7f3eb8a` — E02 outage harness and canonical tests
  - final receipt commit records this file

## Runtime probe

Single normal recovery probe only:

```text
node --version => v22.16.0
npm --version => 10.9.2
corepack --version => 0.32.0
pnpm --version => bash: pnpm: command not found
getent hosts github.com => no output
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint1 => Could not resolve host: github.com
ts-node --version => v10.9.2
```

Canonical pnpm/Git access remained unavailable, so the sprint entered Runtime Outage Mode.

## Completed slices

### INT1-W1-T1 — Property persistence adapter

State: IMPLEMENTED

Added:
- `src/server/core/property-repository.ts`
- `src/server/core/property-read.ts`

Behavior:
- Maps `public.properties` rows to `PropertyDTO`.
- Preserves optional `label`, `addressLine2`, `region`, `serviceNotes`, `accessNotes`, and `version`.
- Repository contract excludes archived rows by failing closed if an archived row is returned.
- Workspace/customer mismatches fail closed with `PROPERTY_SCOPE_MISMATCH`.
- `readPropertySnapshot(ctx, customerId, repository)` is staff-only for OWNER/DISPATCHER and does not invent visitor reads.

### INT1-W1-T2 — Request facade

State: IMPLEMENTED

Added:
- `src/server/core/request-facade.ts`

Behavior:
- Implements `ServiceDeskFacade.createRequest` and `ServiceDeskFacade.updateRequest` as injected methods.
- Maps `RequestRecord` to `RequestDTO` without exposing `visitorSessionId`.
- Preserves existing visitor-session, workspace, role, and expected-version guards from Core request commands.
- Supports accepted facade fields only; no client-side pricing invented.

### INT1-W1-T3 — Request + Quote + Capacity composition

State: IMPLEMENTED

Added:
- `src/server/core/request-quote-facade.ts`

Behavior:
- Composes request facade, quote facade, and capacity facade into a typed `Pick<ServiceDeskFacade, "createRequest" | "updateRequest" | "calculateQuote" | "sendQuote" | "findSlots" | "holdSlot">`.
- Uses injected repositories only; no singleton provider/database dependency.

### INT1-W1-T4 — Server-only command entrypoint factory

State: IMPLEMENTED

Added:
- `src/server/core/server-entrypoints.ts`

Exposes:
- `createRequestCommand`
- `updateRequestCommand`
- `calculateQuoteCommand`
- `sendQuoteCommand`
- `findSlotsCommand`
- `holdSlotCommand`
- `readPropertySnapshotCommand`

Explicitly not implemented in this sprint:
- `applyVerifiedPayment`
- `transitionVisit`
- `readWorkspaceSnapshot`

### INT1-W1-T5 — Package-free end-to-end Core harness

State: IMPLEMENTED

Added:
- `tests/db/runtime-outage-e02-server-composition-harness.ts`

Command executed in GPT Runtime scratch checkout:

```bash
ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/db/runtime-outage-e02-server-composition-harness.ts
```

Result:

```text
runtime-outage e02 server composition harness PASS
```

The harness executed real modules through server command entrypoints for:
1. visitor request create;
2. visitor update;
3. quote calculation;
4. staff quote send;
5. slot availability;
6. valid slot hold;
7. property read;
8. wrong visitor/workspace/version rejection.

### INT1-W1-T6 — Canonical tests

State: IMPLEMENTED / AUTHORED_NOT_CANONICALLY_EXECUTED

Added:
- `tests/db/property-read.test.ts`
- `tests/db/request-facade.test.ts`
- `tests/db/request-quote-facade.test.ts`
- `tests/db/server-entrypoints.test.ts`

Canonical tests were authored but not run because pnpm/Vitest remains unavailable.

## Changed files

- `src/server/core/property-repository.ts`
- `src/server/core/property-read.ts`
- `src/server/core/request-facade.ts`
- `src/server/core/request-quote-facade.ts`
- `src/server/core/server-entrypoints.ts`
- `tests/db/property-read.test.ts`
- `tests/db/request-facade.test.ts`
- `tests/db/request-quote-facade.test.ts`
- `tests/db/server-entrypoints.test.ts`
- `tests/db/runtime-outage-e02-server-composition-harness.ts`
- `docs/execution/receipts/v1-int1-worker-1.md`

## Proof level

- Outage harness: PASS
- State supported by outage mode: IMPLEMENTED
- Canonical pnpm install: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Canonical Vitest: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Typecheck: NOT_EXECUTED / CONFIGURATION_BLOCKED
- DB/RLS proof: NOT_EXECUTED
- Provider proof: N/A

## Blockers

Canonical gate remains blocked by GPT Runtime package/source access:

```text
pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint1 => Could not resolve host: github.com
```

## Next

READY_NEXT=E03 atomic verified payment core boundary

When canonical access returns, run:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/db/property-read.test.ts tests/db/request-facade.test.ts tests/db/request-quote-facade.test.ts tests/db/server-entrypoints.test.ts tests/db/runtime-outage-e02-server-composition-harness.ts
pnpm test:domain
pnpm test:db
pnpm typecheck
```
