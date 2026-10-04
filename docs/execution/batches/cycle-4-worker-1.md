# ServiceDesk AI — Cycle 4 Worker 1 / Core — Capacity Temporal Safety

Branch: `feat/servicedesk-v1-core`
Expected previous HEAD: `ef19a54e325d4e9ed9baa390a4316e097dbba923`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

Make one quick normal Runtime recovery probe only. If pnpm/Git DNS is still blocked, immediately use Runtime Outage Mode.

## Objective
Harden the existing capacity/hold seam so stale/past capacity and invalid hold durations cannot be represented as bookable/held state.

Source-derived current files:
- `src/domain/capacity.ts`
- `src/server/core/capacity.ts`
- `src/server/core/auth.ts`
- `tests/domain/capacity.test.ts`
- `tests/db/capacity-facade.test.ts`

## CYCLE-4-W1-T1 — Package-free capacity harness
Add `tests/db/runtime-outage-capacity-harness.ts` using Node assert and exact current Core source.

Materialize exact dependencies into GPT Runtime and execute with global `ts-node --transpile-only`.

Required baseline cases:
- valid future 240m + 30m slot remains available;
- active hold still blocks the slot;
- expired hold does not block it.

## CYCLE-4-W1-T2 — Past/invalid slot filtering
Harden `findAvailableSlots(...)`.

A slot must not be returned when:
- its start is at or before `now`;
- its end is at or before `now`;
- timestamps do not form a positive usable window.

Preserve workspace filtering, active-hold filtering, service+buffer capacity rules and future valid slots.

Do not silently convert invalid slots into valid availability.

## CYCLE-4-W1-T3 — Hold-duration and repository-scope hardening
Harden `createSlotHold(...)` so `holdMinutes` must be a positive integer. Invalid values must return a typed Result failure; do not create an already-expired or zero-length HELD record.

In `holdSlotWithRepository(...)`, fail closed if the repository returns a slot whose `workspaceId` does not match the authorized workspace, even though the repository lookup is workspace-scoped.

Do not weaken existing OWNER/DISPATCHER authorization.

## CYCLE-4-W1-T4 — Canonical regressions
Add Vitest cases covering:
- past slot excluded;
- slot starting exactly at now excluded;
- malformed/non-positive slot window excluded;
- zero/negative/non-integer holdMinutes rejected;
- cross-workspace repository slot fails closed;
- valid future hold still expires exactly 15 minutes after meta.now through the server command.

Run the outage harness. If pnpm recovers, run focused capacity tests, domain/db suites and typecheck.

## Proof
Outage harness PASS supports `IMPLEMENTED` only.
Without canonical pnpm/Vitest/typecheck, `CANONICAL_GATE=CONFIGURATION_BLOCKED`.
Do not claim DB/RLS or OPERATIONS_VERIFIED.

## Receipt
Write `docs/execution/receipts/worker-1-cycle-4.md`.

Return worker/cycle/final SHA/receipt/state/canonical gate.
