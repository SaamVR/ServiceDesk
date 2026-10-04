# ServiceDesk AI Engineering Rules

## Source of truth
The approved Product Specification V2.0 and V1 Implementation Plan govern scope. PostgreSQL is the business source of truth. UI state, AI output, provider responses and model arguments never grant authorization or mutate authoritative state directly.

## Lane ownership
- Worker 1 Core: `supabase/migrations/**`, `src/domain/**`, `src/server/core/**`, `src/server/jobs/**`, `tests/domain/**`, `tests/db/**`.
- Chat 2 Connectors/AI: `src/server/ai/**`, `src/server/integrations/**`, provider API handlers, `tests/ai/**`, `tests/providers/**`, `examples/n8n/**`.
- Chat 3 Product/UI: `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `tests/e2e/**`, `public/**`, presentation docs.
- Dedicated GPT-5.6 Sol coordinator only: `src/contracts/**`, package/lockfile, shared barrel exports, API-handler barrel, deployment config, global taskboard/batch plans, `docs/operations.md` and integration branch. Worker 1 is no longer controller.

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

## Coordinator-led sustained execution
Read `docs/execution/coordinator-four-chat-20261004.md` before every new assignment. It supersedes conflicting ownership, per-lane planning and local-device fallback rules in historical packets. A dedicated GPT-5.6 Sol coordinator plans/reviews/integrates; three GPT-5.5 High workers execute concrete rolling batches targeting 20–30 minutes active work. GPT Runtime Machine is mandatory for development/checks. Save durable progress to GitHub. Never use samai, samvr, SSH/local devices or self-hosted runners. Runtime limitations must be recorded and repaired in Runtime, never converted into PASS. Coordinator owns global taskboard/contracts/integration; workers own lane receipts and assigned code. Preserve all newer progress and actual evidence.
