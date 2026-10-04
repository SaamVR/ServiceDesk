# ServiceDesk AI — Cycle 3 Worker 1 / Core — Outage Mode

Branch: `feat/servicedesk-v1-core`
Expected previous HEAD: `c8f6239db5062a6e7306de1c70686b3e0ac7dfd0`

Read in full from the coordinator pin supplied in dispatch:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- this packet

## First action
Verify remote branch HEAD and preserve every legitimate newer commit.

Make only ONE quick normal Runtime recovery probe:
- `getent hosts github.com || true`
- `getent hosts registry.npmjs.org || true`
- `pnpm --version || true`

If normal access works, use the canonical pnpm/Vitest path.
If it is still blocked, immediately enter outage mode. Do not spend the run retrying DNS.

## CYCLE-3-W1-T1 — Exact-source outage harness
Through connected GitHub access, read the exact current branch versions of:
- `src/domain/operations.ts`
- `src/server/core/operations.ts`
- `tests/db/operations-commands.test.ts`

Materialize the exact relevant source into GPT Runtime scratch space under `/mnt/data`.

Create a package-free Node assertion harness that executes the actual Core operations seam with global `ts-node --transpile-only`.

Required executable cases:
1. duplicate ledger idempotency returns `created:false` and does not call insert;
2. terminal outbox failure at max attempts returns `FAILED` and removes `nextAttemptAt`;
3. duplicate open attention returns `created:false` and does not call insert;
4. repository failure result propagates without being converted to success.

The coordinator already proved these semantics are runnable under outage mode; reproduce them on your exact branch source.

## CYCLE-3-W1-T2 — Add canonical regression cases
Update only `tests/db/operations-commands.test.ts` to add the missing canonical Vitest assertions above.

Also add:
- `tests/db/runtime-outage-operations-harness.ts`

The outage harness must use Node `assert`, import the real Core source, and contain no dependency on Vitest.

Run the outage harness in GPT Runtime using the global ts-node.

If pnpm recovered, also run:
- `pnpm vitest run tests/db/operations-commands.test.ts`
- `pnpm test:domain`
- `pnpm test:db`
- `pnpm typecheck`

## CYCLE-3-W1-T3 — Review and durable write
Inspect every changed path after writing through GitHub.
No source behavior change is required unless the executable harness exposes a real defect.

Do not edit shared contracts, package files, DB migrations, Product/UI, or Connector files.

## Proof
If outage harness passes but canonical package suite remains unavailable:
- implementation/test additions may be labelled `IMPLEMENTED`;
- canonical test gate remains `CONFIGURATION_BLOCKED`;
- do NOT claim `CONTRACT_TESTED` or `OPERATIONS_VERIFIED`.

## Receipt
Write `docs/execution/receipts/worker-1-cycle-3.md`.

Return:
`WORKER=1`
`CYCLE=3`
`FINAL_SHA=<sha>`
`RECEIPT=docs/execution/receipts/worker-1-cycle-3.md`
`STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>`
`CANONICAL_GATE=<state>`
