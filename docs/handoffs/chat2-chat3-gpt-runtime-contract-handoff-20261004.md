# ServiceDesk AI V1 — GPT Runtime Lane Contract Handoff

Date: 2026-10-04
Controller: Chat 1 — Core Domain, Database and Integration Controller

## Purpose

This is the repository-level coordination contract for Chat 2 (AI/providers) and Chat 3 (product/UI) while development runs on the GPT Runtime Machine and progress is saved continuously to GitHub.

The approved Product Spec V2.0, Implementation Plan, `AGENTS.md`, and `docs/contracts-v1.md` remain authoritative.

## Frozen shared contract

Frozen contract/base commit:

`dbf1f756d588925a694a4131672248ddb21a14e3`

It freezes:

- `ActorContext { userId?, visitorSessionId?, workspaceId, role }`
- `CommandMeta { idempotencyKey, expectedVersion?, now }`
- `Result<T>`
- `RequestDTO`, `QuoteDTO`, `SlotDTO`, `VisitDTO`, `InvoiceDTO`, `ConversationDTO`, `IntegrationStatusDTO`, `AttentionItemDTO`
- `ServiceDeskFacade` in `src/server/core/facade.ts`

Chat 2 and Chat 3 consume these interfaces. They MUST NOT casually edit shared contracts, barrel exports, package/lockfile, migrations, or Chat 1 core files.

If a required interface is missing, do not bypass the facade by writing directly to PostgreSQL or duplicating business truth. Report the exact requested type/signature and continue independent lane-owned work. Chat 1 resolves shared interface changes centrally.

## Observed lineage before installing this handoff

- Integration: `feat/servicedesk-v1-integrate` @ `6e8a517d25c6d4f12cd8b4c1ad423e2feaf34a10`
- Core: `feat/servicedesk-v1-core` @ `ec20eb7b5ed8e359b1864b57b9158b8a671ba833`
- Connectors: `feat/servicedesk-v1-connectors` @ `6e90d86f17de052975ec3aa68d416b7dd14b0fa4`
- Product: `feat/servicedesk-v1-product` @ `5320b1abf583c06ed37e2657ec0c151bfde423b8`

These are observations, NOT reset targets. Fetch and verify the actual remote branch head before editing. Preserve every legitimate newer commit.

## GPT Runtime Machine workflow

Use the GPT Runtime Machine as the primary development environment.

At the beginning of every cycle:

1. Locate or clone only `SaamVR/ServiceDesk`.
2. Read `AGENTS.md`, Product Spec V2.0, Implementation Plan, `docs/contracts-v1.md`, and this handoff.
3. Run `git fetch origin --prune`.
4. Verify `git remote -v`, branch, `git rev-parse HEAD`, and `git status --short`.
5. Work only in an isolated worktree for the assigned branch.
6. If remote is newer than the prompt, preserve it and report `NEWER_BRANCH_HEAD=<sha>`.
7. Never reset, force-push, discard, or overwrite legitimate progress.

During implementation:

- Choose the next smallest independently reviewable plan task.
- Use test-first development for behavior.
- Keep PostgreSQL/Core facade as business authority.
- Fixtures/mock callbacks prove contracts only; never present them as provider proof.
- Commit each reviewable slice with a focused conventional commit.
- Push the assigned branch after each completed slice. GitHub is the durable progress record.
- Prefer Runtime-local checks; do not burn GitHub Actions merely to replace checks that can run locally.
- If credentials or an external service block a proof, record the exact blocker and continue independent work.

Every checkpoint must report:

- branch
- exact HEAD
- frozen contract SHA
- changed paths
- tests/checks actually run and results
- provider/browser evidence actually observed
- blockers
- requested shared-interface changes
- next smallest task

## Chat 2 lane

Branch: `feat/servicedesk-v1-connectors`

Own:

- `src/server/ai/**`
- `src/server/integrations/**`
- provider API handler modules
- `tests/ai/**`
- `tests/providers/**`
- `examples/n8n/**`
- provider setup/evidence docs explicitly assigned to this lane

Do not edit migrations, domain/core commands, UI routes/features, shared package/lockfile, or shared contract barrel files.

Provider fixture tests are CONTRACT_TESTED only. PROVIDER_VERIFIED requires controlled real provider evidence.

## Chat 3 lane

Branch: `feat/servicedesk-v1-product`

Own:

- `src/app/**`
- `src/features/**`
- `src/components/**`
- `src/styles/**`
- `public/**`
- `tests/e2e/**`
- `docs/presentation/**`

Use facade/API DTOs. Typed fixtures are allowed only for temporary/sample display states and must never become a second business truth.

Do not edit migrations, domain/core commands, provider adapters, shared package/lockfile, or shared contract barrel files.

## Integration rule

Workers DO NOT merge themselves into `feat/servicedesk-v1-integrate`.

When a slice is ready, push it and report its exact commit SHA. Chat 1 will inspect the actual diff, verify ownership, run the appropriate gates, integrate sequentially, and publish the new integration SHA.

A chat message saying "done" is never sufficient integration evidence.

## Release evidence labels

Use only:

- IMPLEMENTED
- CONTRACT_TESTED
- PROVIDER_VERIFIED
- OPERATIONS_VERIFIED
- CONFIGURATION_BLOCKED

Never promote mocked or fixture evidence to PROVIDER_VERIFIED.

No live external messages, payment attempts, production database mutations, or provider traffic except explicitly authorized controlled testing in the selected development environment.
