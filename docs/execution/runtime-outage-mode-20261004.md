# ServiceDesk AI — GPT Runtime Outage Execution Mode

Date: 2026-10-04
Status: ACTIVE while normal GPT Runtime GitHub/npm DNS remains unavailable.

## Why this exists

Two consecutive worker cycles reproduced the same infrastructure condition:

- `github.com` does not resolve from GPT Runtime git transport;
- `registry.npmjs.org` does not resolve / Corepack cannot fetch pnpm;
- `pnpm` is unavailable;
- connected GitHub reads/writes continue to work;
- GPT Runtime still provides Node 22, global TypeScript and global ts-node.

Repeatedly spending worker runs only retrying DNS is no longer useful.

## Outage-mode execution contract

When the normal pnpm/Vitest/build path is unavailable, a worker MAY continue a bounded package-free slice if all of the following are true:

1. The exact source is read from the worker branch through connected GitHub access.
2. The slice stays strictly inside the worker's owned paths.
3. The changed behavior is pure TypeScript / Node-standard-library logic and does not require React, Next runtime, a database, live provider access, or third-party packages to exercise.
4. The worker materializes the exact relevant source subset into GPT Runtime scratch space under `/mnt/data`.
5. The worker executes the exact changed behavior with global `ts-node` and Node `assert` (prefer `--transpile-only` when project package types are unavailable).
6. The worker statically inspects every GitHub write and records the exact changed paths.
7. The worker publishes an outage receipt.

GitHub connector access is still NOT itself executable proof. The executable proof is the Runtime ts-node/Node harness.

## Proof labels

Outage-mode evidence may support:
- `IMPLEMENTED` for a bounded changed behavior when the exact logic is exercised by the Runtime harness.

It does NOT by itself support:
- `CONTRACT_TESTED` — canonical Vitest/full project typecheck is still required;
- `PROVIDER_VERIFIED` — controlled live provider evidence is still required;
- `OPERATIONS_VERIFIED` — real DB/operations proof is still required where applicable.

The canonical pnpm/Vitest/typecheck/lint/build/browser gate remains `CONFIGURATION_BLOCKED` until package/network access returns.

## Integration rule during outage

The coordinator may integrate a bounded outage-mode implementation as `IMPLEMENTED` only when:
- the range is ownership-clean;
- the exact changed pure logic was executed in GPT Runtime;
- the coordinator can independently reproduce or inspect the harness result;
- no shared contract, package, deployment, DB migration, React/Next runtime, or live-provider behavior is being silently treated as verified.

Cross-cutting/shared changes stay coordinator-owned.

## Product/UI restriction

React/Next/browser-dependent work remains frozen during outage mode.

Product/UI may work on:
- pure `view-models.ts` / data transformation logic;
- package-free Node assertion harnesses;
- static source-boundary checks.

No browser/build/accessibility-runtime claim may be made without the normal stack.

## Catch-up gate

As soon as GitHub/npm access returns:
1. run `corepack prepare pnpm@10.17.1 --activate`;
2. `pnpm install --frozen-lockfile`;
3. run each lane's canonical focused suites;
4. run project typecheck/lint/build where applicable;
5. downgrade/repair any outage-mode implementation that fails;
6. only then promote proof labels beyond `IMPLEMENTED`.

## Coordinator-validated outage harness prototypes

The coordinator has already executed three proof-of-viability scratch harnesses in GPT Runtime:

- Core operations: duplicate ledger, terminal outbox, duplicate attention, repository error propagation → PASS.
- WhatsApp inbound: per-record persistence outcomes, inserted-only processor handoff, unsupported/media handling, processor failure identity → PASS.
- Product reporting: orphan/duplicate visit request IDs cannot inflate request conversion above supplied-request truth → PASS.

These prototype results authorize Cycle 3 outage-mode work but are not substitutes for each worker's own receipt.
