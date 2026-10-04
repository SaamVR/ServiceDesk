# ServiceDesk AI — Cycle 1 Worker 3 Product/UI Batch

Published by dedicated coordinator on 2026-10-04.

## Retrieval / branch
- Worker model: GPT-5.5 High
- Worker branch: `feat/servicedesk-v1-product`
- Current worker branch head observed by coordinator: `1345ed36455e415cc4acc7a0c9fb145866dc95bc`
- Current integration head observed by coordinator before Cycle 1 packet commits: `a50c7c6adcc8bdc4d50b5b706045a76b71a86a4f`
- Contract source: `docs/contracts-v1.md` + `src/contracts/**` on integration.
- Coordinator packet ref: `feat/servicedesk-v1-integrate` after this file is committed.

## Coordinator observations before dispatch
- `AGENTS.md` assigns Worker 3 ownership to `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `tests/e2e/**`, `public/**`, and presentation docs.
- Product ledger says E01 and props-only E02 work were authored but unverified. Runtime lacked checkout/pnpm/DNS, so tests/build/browser were NOT EXECUTED.
- Current `RequestSummaryPreview.tsx` on product branch accepts `RequestDTO` and `QuoteDTO` props and no longer imports sample data.
- Chat 1 has accepted only `PropertyDTO` / `readPropertySnapshot` conceptually; other shared interface requests remain deferred. Do not wire server actions until coordinator publishes exact accepted signatures.
- Vitest files under `tests/e2e` are static/unit contract tests unless a real browser command is run and recorded.

## Allowed paths
Primary implementation paths:
- `src/app/**`
- `src/features/**`
- `src/components/**`
- `src/styles/**`
- `tests/e2e/**`
- `public/**`
- product presentation docs under `docs/presentation/**`

Receipt path:
- `docs/execution/receipts/worker-3-cycle-1.md`

Forbidden unless a later coordinator packet explicitly grants exclusive ownership:
- `src/contracts/**`
- `src/server/core/**`, `src/domain/**`, `supabase/migrations/**`
- `src/server/integrations/**`, `src/server/ai/**`, provider handlers
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `docs/taskboard.md`, `docs/execution/coordinator-ledger.md`, integration branch

## Batch objective
Verify or repair the product lane’s current props-only work and disabled fixture boundaries without expanding fixture-only previews or inventing server contracts.

---

## CYCLE-1-W3-T1 — Re-establish executable Product/UI verification gate

State: READY  
Dependency: none  
Base SHA: `1345ed36455e415cc4acc7a0c9fb145866dc95bc`  
Capability outcome: exact product test/build/browser state is known.

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
   git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-product
   ```
2. In GPT Runtime only, create or reuse an isolated checkout of `feat/servicedesk-v1-product`. Preserve newer commits; no reset/rebase/force-push.
3. Run exactly:
   ```bash
   corepack prepare pnpm@10.17.1 --activate || true
   pnpm install --frozen-lockfile
   pnpm test tests/e2e/request-summary-view-model.test.ts tests/e2e/product-action-boundary.test.ts tests/e2e/view-model-boundary.test.ts tests/e2e/sample-data-integrity.test.ts tests/e2e/accessibility-contract.test.ts tests/e2e/route-family-contract.test.ts tests/e2e/presentation-tour-contract.test.ts
   pnpm typecheck
   pnpm lint
   pnpm build
   ```
4. If executable browser check becomes possible after build, run a local route smoke only from GPT Runtime and record route URLs/results. Do not use external/local devices.

Acceptance:
- PASS only if commands actually run and pass.
- BLOCKED if clone/install/package/build/browser cannot execute; record exact command/error.
- ACTIVE_REPAIR if the failing files are Product/UI-owned.

---

## CYCLE-1-W3-T2 — Repair Product/UI-owned compile/test/build failures

State: READY_AFTER_T1_FAILURES  
Dependency: `CYCLE-1-W3-T1` produced Product/UI-owned failures  
Capability outcome: product branch builds/tests without changing server contracts or connector/core code.

Repair surfaces:
- `src/app/**`
- `src/features/**`
- `src/components/**`
- `src/styles/**`
- `tests/e2e/**`
- `public/**`

Rules:
- Fix only real failures named by T1.
- If a failure requires missing server facade/DTO signatures, stop and record the dependency instead of inventing signatures.
- Keep disabled fixture actions visibly disabled; do not make preview buttons look live.
- Do not claim browser proof from static Vitest files.

Verification after repair:
```bash
pnpm test tests/e2e/request-summary-view-model.test.ts tests/e2e/product-action-boundary.test.ts tests/e2e/view-model-boundary.test.ts tests/e2e/sample-data-integrity.test.ts tests/e2e/accessibility-contract.test.ts tests/e2e/route-family-contract.test.ts tests/e2e/presentation-tour-contract.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Acceptance:
- Commit repair plus tests together.
- Receipt names the exact failure fixed and final command results.

---

## CYCLE-1-W3-T3 — Props-only request-intake boundary hardening

State: READY_IF_T1_GREEN_OR_AFTER_T2_GREEN  
Dependency: product checks executable or exact product-owned failures repaired  
Capability outcome: request-intake reusable UI is DTO-driven, while fixture/demo ownership is isolated and visibly disabled.

Source-derived current files to inspect:
- `src/features/request-intake/RequestSummaryPreview.tsx`
- `src/features/request-intake/RequestSummaryFixturePreview.tsx`
- `src/features/request-intake/EnquiryForm.tsx`
- `src/features/operations/OperationalRoute.tsx`
- `tests/e2e/request-summary-view-model.test.ts`
- `tests/e2e/product-action-boundary.test.ts`

Work:
1. Verify `RequestSummaryPreview.tsx` imports only `QuoteDTO`, `RequestDTO`, and local view-models; no sample-data import.
2. Verify fixture data is owned by `RequestSummaryFixturePreview.tsx` or an explicitly labelled demo wrapper.
3. Verify `EnquiryForm` and preview actions remain read-only/disabled until an accepted server facade arrives.
4. Add/repair Product/UI tests only if any of the above is not pinned.

Focused command:
```bash
pnpm test tests/e2e/request-summary-view-model.test.ts tests/e2e/product-action-boundary.test.ts
```

Acceptance:
- DTO-driven components remain reusable for future server wiring.
- No server action is introduced in Cycle 1.

---

## CYCLE-1-W3-T4 — Product route and fixture-claim smoke ledger

State: READY_AFTER_T1/T2/T3  
Dependency: executable checks completed or exact Runtime blocker captured  
Capability outcome: coordinator can decide whether product range is reviewable or blocked.

Required route list for smoke evidence if build/dev/browser is available:
- `/b/brightroom/enquire`
- `/portal`
- `/app/brightroom/inbox`
- `/crew/today`
- `/tour`
- `/presentation`

If browser is unavailable, do not fake it. Record `BROWSER_NOT_EXECUTED` and include the exact blocker.

Create/update:
- `docs/execution/receipts/worker-3-cycle-1.md`

Receipt must include:
- start SHA and final SHA;
- slice states;
- files changed;
- commands/results: focused tests, typecheck, lint, build, browser smoke if any;
- fixture boundary state: `DISABLED_PREVIEW_ONLY` or exact exception;
- server wiring state: `NOT_STARTED`, unless coordinator signatures are published later;
- next recommended task ID.

Commit:
```bash
git add src/app src/features src/components src/styles tests/e2e public docs/presentation docs/execution/receipts/worker-3-cycle-1.md
git commit -m "test(product): verify request intake preview boundaries"
git push origin feat/servicedesk-v1-product
```

Only include paths that actually changed; do not create empty or cosmetic commits.

## Independent fallbacks
Use only when Runtime cannot execute or first failure is non-owned:
1. Static disabled-action audit across `src/features/**` and `tests/e2e/product-action-boundary.test.ts`, saved in receipt. No PASS claim.
2. Static sample-data ownership audit for request-intake/product surfaces, saved in receipt. No server-wiring claim.

## Stop condition
Stop after the receipt if clone/install/test/build cannot execute in GPT Runtime or if the first real failure requires coordinator-owned shared contracts/server facade/package changes. Do not start server-backed request create/edit or checkout wiring in Cycle 1.