# ServiceDesk AI Engineering Rules

## Source of truth
The approved Product Specification V2.0 and V1 Implementation Plan govern scope. PostgreSQL is the business source of truth. UI state, AI output, provider responses and model arguments never grant authorization or mutate authoritative state directly.

## Lane ownership
- Chat 1 Core/controller: `supabase/migrations/**`, `src/contracts/**`, `src/domain/**`, `src/server/core/**`, `src/server/jobs/**`, `tests/domain/**`, `tests/db/**`.
- Chat 2 Connectors/AI: `src/server/ai/**`, `src/server/integrations/**`, provider API handlers, `tests/ai/**`, `tests/providers/**`, `examples/n8n/**`.
- Chat 3 Product/UI: `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `tests/e2e/**`, `public/**`, presentation docs.
- Integrator only: package/lockfile, shared barrel exports, API-handler barrel, deployment config, `docs/operations.md`.

## Engineering discipline
1. Work from an observed commit SHA in an isolated branch/worktree.
2. Preserve tenant scoping and server-side authorization on every business mutation.
3. Use integer minor currency units and explicit timezone rules.
4. Provider callbacks are verified, deduplicated and non-regressive.
5. Durable business transaction and outbox writes are atomic.
6. Use test-first development for behavior. Record exact evidence before claiming completion.
7. Never commit secrets, provider credentials, customer data or fabricated receipts.
8. Provider mocks prove contracts only; controlled provider receipts are required for PROVIDER_VERIFIED.
9. Keep `docs/taskboard.md` current with READY/ACTIVE/REVIEW/BLOCKED/DONE, branch, SHA, tests/evidence and next dependency.
10. Resolve shared-file conflicts in the controller lane, not in workers.

## Completion labels
Use only: IMPLEMENTED, CONTRACT_TESTED, PROVIDER_VERIFIED, OPERATIONS_VERIFIED, CONFIGURATION_BLOCKED.

## Shared coding quality: Karpathy-inspired guidelines

For coding, review, and refactoring, apply the four principles defined in
.agents/skills/karpathy-guidelines/SKILL.md:

- Think before coding: surface material assumptions and uncertainty; do not silently guess.
- Simplicity first: choose the smallest complete implementation, without speculative abstraction.
- Surgical changes: edit only task-related lines; preserve unrelated code and comments.
- Goal-driven execution: define measurable acceptance criteria and verify with relevant tests.

These are supplementary quality guidelines, NOT authorization to override existing
owner-approved specifications, security constraints, lane/file ownership, release
gates, review vetoes, or deployment approvals. Keep unrelated project work unblocked
when a different lane has a genuine blocker. Do not invent verification evidence.
