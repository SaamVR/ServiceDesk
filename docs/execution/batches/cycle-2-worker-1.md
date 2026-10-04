# ServiceDesk AI — Cycle 2 Worker 1 / Core

Branch: `feat/servicedesk-v1-core`
Expected previous Cycle 1 final SHA: `971225ef8f6fb1b93e26139fb66259373c6557f2`

Use GPT Runtime Machine only for checkout, package install, tests, typecheck, build, DB and browser execution. Do not use samai, samvr, SSH/local devices, self-hosted runners, or GitHub Actions. Connected GitHub access may be used only for repository reads/writes when Runtime transport is blocked; it is not executable proof.

Read in full before doing anything:
- AGENTS.md
- docs/execution/coordinator-four-chat-20261004.md
- this packet

Preserve every legitimate newer commit. Never reset/rebase/force-push or overwrite newer work.

Cycle 1 established a shared infrastructure blocker: GPT Runtime could not resolve github.com or registry.npmjs.org and pnpm could not be activated. Historical local-device PASS evidence is not accepted.

## Objective
Recover executable Core verification first. If the Runtime gate becomes green, immediately continue the deferred operations seam work in the same run. Target a sustained 20–30 minutes of useful work when executable.

## CYCLE-2-W1-T1 — Runtime recovery + executable gate
1. Verify branch/HEAD/working tree.
2. Verify DNS/source/package access.
3. Establish checkout and run:
   - `corepack prepare pnpm@10.17.1 --activate`
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm test:domain`
   - `pnpm test:db`
   - `pnpm vitest run tests/db/operations-commands.test.ts`
4. Record exact commands/results.

If any failure is Core-owned, continue to T2. If failure is shared/non-owned, record it exactly.

## CYCLE-2-W1-T2 — Repair only reproduced Core-owned failures
Allowed source ownership remains:
- `supabase/migrations/**`
- `src/domain/**`
- `src/server/core/**`
- `src/server/jobs/**`
- `tests/domain/**`
- `tests/db/**`

Do not edit coordinator-owned shared contracts, package files, deployment config, shared barrels, or other lanes.

For each repair: reproduce → smallest fix → focused test → inspect diff → commit.

## CYCLE-2-W1-T3 — Deferred operations repository hardening
Once T1/T2 is green, inspect current `OperationsRepository` command seam in `src/server/core/operations.ts` and the current DB tests. Add only missing tests/repairs for:
- duplicate ledger command returns `created:false` without a second insert;
- max-attempt outbox failure clears `nextAttemptAt`;
- duplicate attention item returns `created:false` without a second insert;
- repository insert failure propagates rather than being silently converted to success.

Run the focused operations test after every slice, then the broader domain/DB suites.

Do not claim SQL/RLS or real database proof unless an actual DB reset/integration path is executed.

## Blocked fallback
If Runtime source/package access is still blocked:
- do not change application source;
- use GitHub reads to statically inventory the exact current operations seam and tests;
- identify the next 3 smallest missing Core-owned assertions/repairs, with exact files/symbols derived from source;
- publish that map only in the receipt so the next executable run can start immediately.

## Receipt
Write `docs/execution/receipts/worker-1-cycle-2.md`.
Report final SHA, changed files, command results, proof level, and exact unresolved blocker if any.
