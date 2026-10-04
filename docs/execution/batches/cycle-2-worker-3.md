# ServiceDesk AI — Cycle 2 Worker 3 / Product & UI

Branch: `feat/servicedesk-v1-product`
Expected previous Cycle 1 final SHA: `7857818c57634bb925549ea52fd380b031d426e1`

Use GPT Runtime Machine only for checkout, package install, tests, typecheck, build, DB and browser execution. Do not use samai, samvr, SSH/local devices, self-hosted runners, or GitHub Actions. Connected GitHub access may be used only for repository reads/writes when Runtime transport is blocked; it is not executable proof.

Read in full before doing anything:
- AGENTS.md
- docs/execution/coordinator-four-chat-20261004.md
- this packet

Preserve every legitimate newer commit. Never reset/rebase/force-push or overwrite newer work.

Cycle 1 established a shared infrastructure blocker: GPT Runtime could not resolve github.com or registry.npmjs.org and pnpm could not be activated. Historical local-device PASS evidence is not accepted.

## Objective
Recover executable Product/UI verification and complete browser/build evidence for the existing props-only request-intake boundary. Do not introduce server-backed mutations until coordinator-owned shared signatures are accepted.

## CYCLE-2-W3-T1 — Runtime recovery + Product gate
Verify branch/HEAD/working tree, establish checkout/package access, then run:
- `corepack prepare pnpm@10.17.1 --activate`
- `pnpm install --frozen-lockfile`
- focused Product tests:
  `pnpm test tests/e2e/request-summary-view-model.test.ts tests/e2e/product-action-boundary.test.ts tests/e2e/view-model-boundary.test.ts tests/e2e/sample-data-integrity.test.ts tests/e2e/accessibility-contract.test.ts tests/e2e/route-family-contract.test.ts tests/e2e/presentation-tour-contract.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

## CYCLE-2-W3-T2 — Repair only reproduced Product-owned failures
Allowed ownership:
- `src/app/**`
- `src/features/**`
- `src/components/**`
- `src/styles/**`
- `tests/e2e/**`
- `public/**`
- Product presentation docs

Do not invent shared contracts or server facade signatures. Missing server contracts are a coordinator blocker, not permission to create substitutes.

## CYCLE-2-W3-T3 — Request-intake boundary executable proof
Confirm in executable tests that:
- `RequestSummaryPreview` remains DTO-driven and sample-data free;
- fixture/sample ownership stays in the fixture wrapper;
- `EnquiryForm` remains visibly preview/read-only;
- no preview action can mutate tenant or provider state;
- route composition still satisfies boundary tests.

Only make Product-owned changes when a failing executable test demonstrates the need.

## CYCLE-2-W3-T4 — Browser route smoke
When build/dev server/browser are available, smoke:
- `/b/brightroom/enquire`
- `/portal`
- `/app/brightroom/inbox`
- `/crew/today`
- `/tour`
- `/presentation`

Check render, obvious console/runtime errors, disabled preview actions, basic responsive behavior, and the existing presentation route contract. Do not label provider-backed behavior as verified.

## Blocked fallback
If Runtime remains blocked:
- do not change application source;
- statically inspect the exact route/component/test relationships through GitHub;
- produce a route-by-route smoke checklist and exact Product-owned likely failure points derived from source;
- record it only in the receipt.

## Receipt
Write `docs/execution/receipts/worker-3-cycle-2.md`.
Report final SHA, changed files, test/build/browser results, proof level, and blocker.
