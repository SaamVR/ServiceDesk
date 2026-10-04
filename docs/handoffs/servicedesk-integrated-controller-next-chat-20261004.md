# ServiceDesk AI V1 — Integrated Controller Next-Chat Handoff

Date: 2026-10-04
Repo: https://github.com/SaamVR/ServiceDesk
Purpose: continue ServiceDesk AI V1 in one GPT Runtime controller chat and integrate Chat 2 / Chat 3 work only after real review and checks.

## Non-negotiable operating mode

Use the GPT Runtime Machine as the main development environment. Save progress in GitHub with small, reviewable commits. Do not claim provider success, production readiness, or completion from mocked tests. Provider adapters can be contract-tested, but only controlled provider receipts count as provider verification.

Never use TingTune, SM Manager, EZComo, or any unrelated repo. Work only in `SaamVR/ServiceDesk`.

Read these first:

1. `AGENTS.md`
2. attached Product Spec V2.0 if supplied in the chat
3. attached Implementation Plan if supplied in the chat
4. `docs/contracts-v1.md`
5. `docs/taskboard.md`
6. this file

If the Product Spec / Implementation Plan are not present as repo files yet, ask the operator to attach them or copy them into `docs/` before making scope decisions. Do not replace their contents from memory.

## Current observed branch heads

Observed during this handoff:

- `main`: `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`
- `feat/servicedesk-v1-integrate`: `240c54d8d51b339aa775e37bae5aff47c699db8c` before this handoff commit
- `feat/servicedesk-v1-core`: `ec20eb7b5ed8e359b1864b57b9158b8a671ba833`
- `feat/servicedesk-v1-connectors`: `6e90d86f17de052975ec3aa68d416b7dd14b0fa4`
- `feat/servicedesk-v1-product`: `5320b1abf583c06ed37e2657ec0c151bfde423b8`
- Contract/foundation base: `dbf1f756d588925a694a4131672248ddb21a14e3`

On resume, fetch and re-verify all heads. If any head changed, preserve newer legitimate progress and update this ledger/taskboard before integration.

## What the worker branches contain

### Chat 1 / Core branch

Branch: `feat/servicedesk-v1-core`
Observed HEAD: `ec20eb7b5ed8e359b1864b57b9158b8a671ba833`

Known progress:

- core migration / RLS / tenant schema slices
- `src/server/core/auth.ts`
- customer/property CSV dry-run, no-partial-commit and export guard
- request command mutation guards
- DB SQL cross-tenant proof
- domain tests for tenant guards, customer import, request command guards

Status: Task 1.1 remains ACTIVE, not DONE. Do not integrate as final unless reviewed and the remaining persistence/repository requirements are either finished or clearly marked partial.

### Chat 2 / Connectors + AI branch

Branch: `feat/servicedesk-v1-connectors`
Observed HEAD: `6e90d86f17de052975ec3aa68d416b7dd14b0fa4`
Ahead of contract base by 16 commits.

Changed paths observed from compare:

- `docs/provider-setup.md`
- `src/server/ai/extraction.ts`
- `src/server/ai/index.ts`
- `src/server/ai/knowledge.ts`
- `src/server/ai/orchestrator.ts`
- `src/server/ai/types.ts`
- `src/server/integrations/google-calendar/adapter.ts`
- `src/server/integrations/index.ts`
- `src/server/integrations/payments/adapter.ts`
- `src/server/integrations/types.ts`
- `src/server/integrations/whatsapp/adapter.ts`
- `tests/ai/corpus.test.ts`
- `tests/providers/provider-boundaries.test.ts`

Review requirements before integration:

- ensure it does not modify Chat 1 or Chat 3 owned paths
- run typecheck/tests if environment permits
- inspect provider claims: fixture/contract tests are allowed, provider-verified claims are not allowed without actual controlled receipts
- ensure WhatsApp/Calendar/payment adapters remain boundary code and do not mutate business source-of-truth directly
- update `docs/taskboard.md` with exact SHA, tests/evidence, and CONFIGURATION_BLOCKED/CONTRACT_TESTED labels as appropriate

### Chat 3 / Product + UI branch

Branch: `feat/servicedesk-v1-product`
Observed HEAD: `5320b1abf583c06ed37e2657ec0c151bfde423b8`
Ahead of contract base by 46 commits.

Changed paths observed from compare include:

- `docs/presentation/storyboard.md`
- route shells under `src/app/**`
- `src/components/shell/MarketingShell.tsx`
- product/operations features under `src/features/**`
- `src/app/globals.css`
- `tests/e2e/showcase-content.test.ts`

Review requirements before integration:

- ensure UI copy does not claim live providers, revenue, testimonials, compliance, or production readiness
- ensure product/tour/presentation labels separate sample/showcase state from real provider evidence
- ensure UI uses contracts/facade DTOs or static placeholders only where explicitly temporary
- do not let UI mutate business truth directly
- run build/e2e/responsive checks if environment permits; if not, record CONFIGURATION_BLOCKED/UNVERIFIED rather than claiming browser proof

## Integration order

Use sequential integration. Do not merge all branches at once.

Recommended order:

1. Re-verify integration branch current HEAD.
2. Re-verify core/connectors/product branch heads.
3. Review core branch first because migrations/contracts/server source-of-truth affect both Chat 2 and Chat 3.
4. If core is still partial, either finish the smallest missing Task 1.1 slice or merge only if the taskboard clearly states partial status and tests are green.
5. Integrate Chat 2 next because provider contracts may affect UI statuses.
6. Integrate Chat 3 last because it depends on the contract/API shapes.
7. After each branch integration, run the smallest meaningful check set first: typecheck, relevant unit/provider/UI tests, then build/e2e where available.
8. Update `docs/taskboard.md` after each integration with branch SHA, evidence, blockers, and new integration HEAD.

## Conflict policy

- Resolve conflicts centrally in the integrated controller, not in worker branches.
- Preserve legitimate worker progress.
- If a worker edited another lane's owned path, review it carefully and either move the change into the correct lane or document an integrator ruling.
- Do not erase taskboard or contract history.
- Do not force-push unless there is explicit owner authorization and a verified reason. Prefer normal commits on the integration branch.

## Verification policy

Record exact commands and outputs. If the GPT Runtime Machine cannot run a command because of package/network/runtime limitations, say so precisely and continue with code review / static checks. Do not convert an unavailable check into a pass.

Minimum checks to attempt after integration:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

For provider branches, also run provider/AI tests where available:

```bash
pnpm vitest run tests/providers tests/ai
```

For product branches, also run UI/e2e checks where available:

```bash
pnpm vitest run tests/e2e
```

If Playwright/browser proof is later added, capture evidence paths and cite them in `docs/taskboard.md`.

## Next-chat prompt summary

The next chat should act as one integrated controller, not three isolated chats. It should use GPT Runtime Machine, fetch the repo, inspect all branch heads, integrate Chat 2 and Chat 3 sequentially only after reviewing real commits, keep the taskboard professional, and continue useful Chat 1 core tasks if integration is blocked.
