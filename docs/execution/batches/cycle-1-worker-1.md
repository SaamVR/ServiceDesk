# ServiceDesk AI — Cycle 1 Worker 1 Core Batch

Published by dedicated coordinator on 2026-10-04.

## Retrieval / branch
- Worker model: GPT-5.5 High
- Worker branch: `feat/servicedesk-v1-core`
- Current worker branch head observed by coordinator: `4704a48eadd912f38ce9c981b583c9924bb62c79`
- Current integration head observed by coordinator: `a50c7c6adcc8bdc4d50b5b706045a76b71a86a4f`
- Contract source: `docs/contracts-v1.md` + `src/contracts/**` on integration.
- Coordinator packet ref: `feat/servicedesk-v1-integrate` after this file is committed.

## Coordinator observations before dispatch
- `AGENTS.md` assigns Worker 1/core ownership to `supabase/migrations/**`, `src/domain/**`, `src/server/core/**`, `src/server/jobs/**`, `tests/domain/**`, `tests/db/**`.
- Current core taskboard says quote/capacity/ledger work exists but full `pnpm` suite and DB reset proof were not rerun; ledger/outbox/attention still needs persistence adapter/restart/idempotency proof.
- Coordinator GPT Runtime could not clone the repo: `git clone https://github.com/SaamVR/ServiceDesk.git` failed with `Could not resolve host: github.com`. This is not a PASS. Retry in your GPT Runtime; record exact output.
- Do not use samai/samvr/SSH/local devices/GitHub Actions. If your GPT Runtime cannot clone or install, record exact command/error in the receipt and do only connector-backed static audit; do not mark tests as passed.

## Allowed paths
Primary implementation paths:
- `supabase/migrations/**`
- `src/domain/**`
- `src/server/core/**`
- `src/server/jobs/**`
- `tests/domain/**`
- `tests/db/**`

Receipt path:
- `docs/execution/receipts/worker-1-cycle-1.md`

Forbidden unless a later coordinator packet explicitly grants exclusive ownership:
- `src/contracts/**`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `src/server/integrations/**`, `src/server/ai/**`, provider handlers
- `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`
- `docs/taskboard.md`, `docs/execution/coordinator-ledger.md`, integration branch

## Batch objective
Turn the current core branch from implementation-rich but unverified into a pinned, reviewable core range with exact executable evidence. If Runtime blocks executable checks, produce a precise blocker receipt and do not expand unchecked features.

---

## CYCLE-1-W1-T1 — Re-establish executable core verification gate

State: READY  
Dependency: none  
Base SHA: `4704a48eadd912f38ce9c981b583c9924bb62c79`  
Capability outcome: exact core Runtime state and first real failing command are known.

Steps:
1. Verify branch and tree:
   ```bash
   pwd
   node --version
   npm --version
   corepack --version || true
   pnpm --version || true
   df -h . /tmp
   getent hosts github.com || true
   getent hosts registry.npmjs.org || true
   git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core
   ```
2. In GPT Runtime only, create or reuse an isolated checkout for `feat/servicedesk-v1-core`. Preserve newer commits; no reset/rebase/force-push.
3. Run:
   ```bash
   corepack prepare pnpm@10.17.1 --activate || true
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm test:domain
   pnpm test:db
   pnpm vitest run tests/db/operations-commands.test.ts
   ```
4. If any command fails, save the exact failing command and the first actionable error block in `docs/execution/receipts/worker-1-cycle-1.md`. Continue only if the failing surface is Worker-1-owned.

Acceptance:
- PASS only if commands actually run and pass in GPT Runtime.
- BLOCKED if clone/install/package manager/test runner cannot execute; include exact command and error.
- ACTIVE_REPAIR if the failing errors are inside Worker-1-owned files.

---

## CYCLE-1-W1-T2 — Repair core-owned compile/test failures only

State: READY_AFTER_T1_FAILURES  
Dependency: `CYCLE-1-W1-T1` produced real core-owned failures  
Capability outcome: typecheck/domain/db failures introduced by core branch are fixed without cross-lane edits.

Allowed repair surfaces:
- `src/domain/**`
- `src/server/core/**`
- `src/server/jobs/**`
- `tests/domain/**`
- `tests/db/**`
- `supabase/migrations/**`

Rules:
- Fix the smallest real failures from T1. Do not guess old blockers.
- If failure points to `src/contracts/**`, `package*`, Product/UI, or Connectors/AI, stop and record it as a coordinator-owned or other-lane dependency.
- Preserve existing public signatures unless T1 proves the signature itself is broken and the changed file is Worker-1-owned.

Verification command after repair:
```bash
pnpm typecheck
pnpm test:domain
pnpm test:db
```

Acceptance:
- Commit repair plus failing/passing tests together.
- Receipt names each repaired error and exact command result.

---

## CYCLE-1-W1-T3 — Ledger/outbox/attention repository proof hardening

State: READY_IF_T1_GREEN_OR_AFTER_T2_GREEN  
Dependency: core checks executable or exact failures repaired  
Capability outcome: current operations repository seam proves idempotent ledger, outbox retry, and attention creation in executable tests.

Source-derived interfaces observed by coordinator:
- `OperationsRepository` in `src/server/core/operations.ts`
- `appendLedgerEntryWithRepository(repository, input)`
- `enqueueOutboxEventWithRepository(repository, input)`
- `recordOutboxFailureWithRepository(repository, event, failedAt, maxAttempts)`
- `raiseAttentionItemWithRepository(repository, input)`
- Current focused test: `tests/db/operations-commands.test.ts`

Work:
1. Read `src/server/core/operations.ts`, `src/domain/operations.ts`, and `tests/db/operations-commands.test.ts` from your current branch.
2. Add or adjust only missing tests that prove:
   - duplicate ledger idempotency returns existing entry with `created:false` and does not insert;
   - outbox reaches `FAILED` and clears `nextAttemptAt` at max attempts;
   - duplicate open attention item returns existing item with `created:false` and does not insert;
   - repository insert failure propagates as the original `Result` error.
3. Implement only if the tests expose a real gap.

Focused command:
```bash
pnpm vitest run tests/db/operations-commands.test.ts
```

Broader command:
```bash
pnpm test:domain
pnpm test:db
```

Acceptance:
- No SQL/RLS proof is claimed unless an actual database/Supabase reset command is run and recorded.
- Pure Vitest proof is `CONTRACT_TESTED` only for repository seam behavior.

---

## CYCLE-1-W1-T4 — Prepare core integration receipt

State: READY_AFTER_T1/T2/T3  
Dependency: all executable checks completed or exact Runtime blocker captured  
Capability outcome: coordinator can review or block the core range without rereading the whole chat.

Create/update:
- `docs/execution/receipts/worker-1-cycle-1.md`

Receipt must include:
- start SHA and final SHA;
- every slice state: READY/ACTIVE/REVIEW/BLOCKED;
- exact files changed;
- exact commands and PASS/FAIL/NOT_EXECUTED;
- provider proof: `N/A`;
- database proof level: `NOT_EXECUTED`, `VITEST_ONLY`, or exact DB command output;
- first unresolved blocker;
- next recommended task ID.

Commit:
```bash
git add <changed core files> docs/execution/receipts/worker-1-cycle-1.md
git commit -m "test(core): verify operations repository seam"
git push origin feat/servicedesk-v1-core
```

## Independent fallbacks
Use only when primary work is blocked by non-core dependency:
1. Static ownership audit of current branch diff against `AGENTS.md`, saved in receipt. No PASS claim.
2. Focused review of `docs/taskboard.md` core rows against current branch SHAs, saved in receipt only. Do not edit global taskboard.

## Stop condition
Stop after publishing the receipt if Runtime cannot execute clone/install/test or if the first real failure is outside Worker-1-owned paths. Do not start Field/quality/reporting or subscriptions work in Cycle 1.