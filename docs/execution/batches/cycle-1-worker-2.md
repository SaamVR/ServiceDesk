# ServiceDesk AI — Cycle 1 Worker 2 Connectors/AI Batch

Published by dedicated coordinator on 2026-10-04.

## Retrieval / branch
- Worker model: GPT-5.5 High
- Worker branch: `feat/servicedesk-v1-connectors`
- Current worker branch head observed by coordinator: `30313d3e5485e157cea8d1b86a87bdccf879537c`
- Current integration head observed by coordinator before Cycle 1 packet commits: `a50c7c6adcc8bdc4d50b5b706045a76b71a86a4f`
- Contract source: `docs/contracts-v1.md` + `src/contracts/**` on integration.
- Coordinator packet ref: `feat/servicedesk-v1-integrate` after this file is committed.

## Coordinator observations before dispatch
- `AGENTS.md` assigns Worker 2 ownership to `src/server/ai/**`, `src/server/integrations/**`, provider API handlers, `tests/ai/**`, `tests/providers/**`, and `examples/n8n/**`.
- Connector ledger says E01 is still BLOCKED. GPT Runtime package access failed previously with `EAI_AGAIN registry.npmjs.org`; a later local-device report said install passed but real compile/test failures remained. Under the new coordinator packet, local devices are disallowed, so reproduce in GPT Runtime and record exact failures.
- Current connector HEAD has no GitHub status checks attached (`total_count: 0` observed by coordinator).
- Current connector barrel files observed:
  - `src/server/integrations/index.ts` exports provider, recovery, subscription, webhook and closure modules.
  - `src/server/ai/index.ts` exports AI transport/guard/orchestration modules.
- Do not start E02 provider feature expansion until E01 compile/provider/AI test gate is executable or the coordinator explicitly accepts a substitute path.

## Allowed paths
Primary implementation paths:
- `src/server/integrations/**`
- `src/server/ai/**`
- `src/server/api-handlers/provider-*`
- `tests/providers/**`
- `tests/ai/**`
- `examples/n8n/**`
- connector/provider docs under `docs/provider-*` or `docs/handoffs/chat2-*` only when needed for receipt context

Receipt path:
- `docs/execution/receipts/worker-2-cycle-1.md`

Forbidden unless a later coordinator packet explicitly grants exclusive ownership:
- `src/contracts/**`
- `src/server/core/**`, `src/domain/**`, `supabase/migrations/**`
- `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `docs/taskboard.md`, `docs/execution/coordinator-ledger.md`, integration branch

## Batch objective
Convert Connector/AI E01 from vague BLOCKED into exact executable errors, then repair only Worker-2-owned compile/test failures until `pnpm typecheck`, `tests/providers`, and `tests/ai` are green or a non-Worker-2 blocker is precisely recorded.

---

## CYCLE-1-W2-T1 — Capture exact connector verification failures in GPT Runtime

State: READY  
Dependency: none  
Base SHA: `30313d3e5485e157cea8d1b86a87bdccf879537c`  
Capability outcome: exact failing connector command and actionable error transcript are known.

Steps:
1. Verify runtime and branch:
   ```bash
   pwd
   node --version
   npm --version
   corepack --version || true
   pnpm --version || true
   df -h . /tmp
   getent hosts github.com || true
   getent hosts registry.npmjs.org || true
   git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-connectors
   ```
2. In GPT Runtime only, create or reuse an isolated checkout of `feat/servicedesk-v1-connectors`. Preserve newer commits; no reset/rebase/force-push.
3. Run exactly:
   ```bash
   corepack prepare pnpm@10.17.1 --activate || true
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm vitest run tests/providers
   pnpm vitest run tests/ai
   ```
4. If install/typecheck/test cannot run because of Runtime DNS/package/git failure, write that exact blocker to the receipt and stop unchecked feature expansion.

Acceptance:
- PASS only if all four executable commands actually pass in GPT Runtime.
- ACTIVE_REPAIR only if the first failures are inside Worker-2-owned code/tests.
- BLOCKED if failures require shared contracts/core/package/Product changes or external provider credentials.

---

## CYCLE-1-W2-T2 — Repair connector-owned typecheck/import/test failures

State: READY_AFTER_T1_FAILURES  
Dependency: `CYCLE-1-W2-T1` produced Worker-2-owned failures  
Capability outcome: connector barrel/tests compile without touching shared contracts or package files.

Likely source-derived surfaces to inspect first:
- `src/server/integrations/index.ts`
- `src/server/ai/index.ts`
- every missing module or duplicate export named by `pnpm typecheck`
- failing files under `tests/providers/**` and `tests/ai/**`

Repair rules:
- Fix missing imports/exports by either adding the intended owned module or removing a stale export only if the file genuinely does not exist and no test expects it.
- Do not widen DTOs or `ServiceDeskFacade` from connector branch.
- Do not mark fixture/mocked tests as `PROVIDER_VERIFIED`; they can support only `IMPLEMENTED`, `CONTRACT_TESTED`, or `CONFIGURATION_BLOCKED`.
- Keep commits coherent: test change + implementation change together.

Verification after each repair slice:
```bash
pnpm typecheck
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

Acceptance:
- Connector E01 can move to REVIEW only when those commands pass or a non-owned blocker is exact and coordinator-visible.

---

## CYCLE-1-W2-T3 — Provider/AI boundary regression tightening

State: READY_IF_T2_GREEN  
Dependency: typecheck/provider/AI suites are executable  
Capability outcome: current connector branch proves that providers never mutate business truth directly and AI cannot authorize payments/pricing/roles.

Work:
1. Inspect existing tests under `tests/providers/**` and `tests/ai/**` before adding anything.
2. Add only missing minimal tests for current modules, preferring existing helpers:
   - provider callback handlers produce durable command/review objects, not direct core table writes;
   - duplicate/out-of-order provider callbacks do not falsely confirm a booking/payment;
   - AI guarded orchestration rejects model output that attempts to set price, payment status, role, or provider proof;
   - handover-active conversations suppress outbound AI send.
3. Use existing module names from `src/server/integrations/index.ts` and `src/server/ai/index.ts`; do not invent cross-lane contracts.

Focused commands:
```bash
pnpm vitest run tests/providers
pnpm vitest run tests/ai
```

Acceptance:
- Tests pass in GPT Runtime.
- Receipt clearly distinguishes mock/fixture proof from missing live provider proof.

---

## CYCLE-1-W2-T4 — Publish connector receipt and pinned range

State: READY_AFTER_T1/T2/T3  
Dependency: executable commands completed or exact blocker captured  
Capability outcome: coordinator can review the connector range without stale Run 7/Run 10 ambiguity.

Create/update:
- `docs/execution/receipts/worker-2-cycle-1.md`

Receipt must include:
- start SHA and final SHA;
- whether the current final SHA includes only docs after prior implementation or real code changes;
- command table: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm vitest run tests/providers`, `pnpm vitest run tests/ai`, each PASS/FAIL/NOT_EXECUTED;
- exact first failure if any;
- provider proof level for each provider: `CONTRACT_TESTED`, `CONFIGURATION_BLOCKED`, or `NOT_EXECUTED`;
- files changed;
- next task ID recommendation.

Commit:
```bash
git add src/server/integrations src/server/ai src/server/api-handlers tests/providers tests/ai examples/n8n docs/execution/receipts/worker-2-cycle-1.md
git commit -m "test(connectors): restore executable provider ai gate"
git push origin feat/servicedesk-v1-connectors
```

Only include paths that actually changed; do not create empty or cosmetic commits.

## Independent fallbacks
Use only when Runtime cannot execute or first failure is non-owned:
1. Static barrel audit: verify every export in `src/server/integrations/index.ts` and `src/server/ai/index.ts` maps to an existing file. Save result to receipt. No PASS claim.
2. Static proof-label audit: search Worker-2-owned tests/docs for `PROVIDER_VERIFIED` and downgrade unsupported claims in Worker-2-owned docs/tests only. No live-provider claim.

## Stop condition
Stop after the receipt if `pnpm install`, clone, or typecheck cannot execute in GPT Runtime, or if the first real failure requires coordinator-owned shared contracts/package/core changes. Do not start E02.