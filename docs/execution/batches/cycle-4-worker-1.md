# ServiceDesk AI — Cycle 4 Worker 1 / Core — DST-safe recurrence

Branch: `feat/servicedesk-v1-core`
Expected previous HEAD: `ef19a54e325d4e9ed9baa390a4316e097dbba923`

Read in full from the exact coordinator ref supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify the remote branch HEAD and preserve every legitimate newer commit.

Perform only one quick normal Runtime recovery probe. If pnpm/Git transport is still blocked, immediately use Runtime Outage Mode.

## Source-derived defect

Current `src/domain/capacity.ts::expandWeeklyRecurrence` preserves the numeric offset from `firstLocalStart` instead of preserving the local wall-clock time in the supplied IANA `timezone`.

Example:
- first local start: `2026-10-19T09:00:00+01:00`
- timezone: `Europe/London`
- one week later crosses the UK DST boundary.

Current behavior produces `2026-10-26T08:00:00.000Z`, which is 08:00 local after DST ends.
Correct weekly recurrence must preserve 09:00 local, therefore the second occurrence must be `2026-10-26T09:00:00.000Z`.

## CYCLE-4-W1-T1 — Preserve wall-clock recurrence across DST
Keep the existing public signature:

`expandWeeklyRecurrence(input: WeeklyRecurrenceInput): RecurringVisitOccurrence[]`

Implement using only Node/ECMAScript standard capabilities; no new dependencies.

Requirements:
1. Treat the local calendar date/time represented by `firstLocalStart` as the recurring wall-clock target.
2. For each weekly occurrence, add 7 local calendar days.
3. Resolve that local date/time in `input.timezone` to the correct UTC instant for that occurrence.
4. Preserve `durationMinutes` in elapsed minutes for `endsAt`.
5. Keep `timezone` on every occurrence.
6. Reject invalid IANA timezone identifiers with a deterministic RangeError or existing domain-style error without changing shared contracts.
7. Preserve existing non-DST behavior.

Do not add a timezone package.

## CYCLE-4-W1-T2 — Regression tests
Update `tests/domain/capacity.test.ts` with:
- existing ordinary weekly recurrence still passes;
- Europe/London fall-back case:
  - 2026-10-19 09:00 local -> 08:00Z
  - 2026-10-26 09:00 local -> 09:00Z
  - 2026-11-02 09:00 local -> 09:00Z
- a spring-forward case proving local wall-clock time remains stable while UTC shifts;
- invalid timezone rejection.

## CYCLE-4-W1-T3 — Outage harness
Add:
`tests/domain/runtime-outage-capacity-recurrence-harness.ts`

Use Node `assert` and the real `src/domain/capacity.ts`.
Run with global `ts-node --transpile-only`.

The harness must assert the DST fall-back behavior above and at least one ordinary recurrence case.

If pnpm recovers, also run:
- `pnpm vitest run tests/domain/capacity.test.ts`
- `pnpm test:domain`
- `pnpm typecheck`

## Restrictions
- Core-owned files only.
- No migrations, package changes, shared contracts, Product/UI, or Connector changes.
- Do not touch visit scheduling atomicity in this cycle.

## Proof
Outage harness PASS permits `IMPLEMENTED`.
Without canonical Vitest/typecheck, canonical gate remains `CONFIGURATION_BLOCKED`.
Do not claim `CONTRACT_TESTED`.

## Receipt
Write:
`docs/execution/receipts/worker-1-cycle-4.md`
