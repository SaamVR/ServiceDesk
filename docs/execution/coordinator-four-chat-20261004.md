# ServiceDesk AI — Dedicated Coordinator and Three Workers
Effective: 2026-10-04. Supersedes conflicting coordinator ownership, local-device fallback and run-planning instructions in older packets. Preserve approved V1 scope and legitimate progress.

## Four-chat operating model
- Coordinator: GPT-5.6 Sol High; branch feat/servicedesk-v1-integrate. Owns task planning, shared contracts, shared config/barrels, global taskboard, review, conflict resolution, integration and release evidence.
- Worker 1: GPT-5.5 High; feat/servicedesk-v1-core. Owns migrations, domain, core persistence/jobs and domain/DB tests. Shared contract edits require coordinator assignment and exclusive ownership for that batch.
- Worker 2: GPT-5.5 High; feat/servicedesk-v1-connectors. Owns AI, integrations, provider handler internals, provider/AI tests and n8n examples.
- Worker 3: GPT-5.5 High; feat/servicedesk-v1-product. Owns app routes, features, components, styles, public assets and UI/browser tests.
Coordinator is the sole integration writer. Worker 1 no longer integrates other workers. Coordinator may assign an exact shared-file change to one worker while retaining approval; never allow concurrent owners.

## Required environment and persistence
Use GPT Runtime Machine for all checkout, editing, package installation, tests, build and browser verification where supported. Do NOT use samai, samvr, SSH to local devices, self-hosted runners or another local device. Do not start GitHub Actions as a substitute without owner authorization.
Runtime checkouts/worktrees are temporary execution spaces. Save durable progress to SaamVR/ServiceDesk GitHub branches: coherent commits and pushes, lane receipts, batch packets, coordinator ledger and integration checkpoints.
Use connected GitHub tools for repository reads/writes if Runtime Git transport is blocked; inspect current file SHA and preserve newer changes. This does not substitute for executing tests.
If Runtime cannot install packages/run required checks, record exact command/error and let coordinator repair the Runtime setup or assign independent useful work. No local-device fallback, fabricated PASS, untested acceptance or automatic provider verification.
Do not delete unrelated files or expose credentials. Save a WIP checkpoint if a tool/turn limit interrupts work; clearly mark it unverified and do not merge as accepted.
Model choice and continuing separate chats require operator/platform activation. A GitHub packet does not automatically wake another ChatGPT conversation. Coordinator supplies ready-to-paste dispatches when direct cross-chat orchestration is unavailable.

## Coordinator startup
Read AGENTS.md, this file, approved spec/implementation plan, latest taskboards, lane plans/receipts and docs/execution/throughput-recovery-20261004.md as historical scope guidance.
Refresh four branch heads. Read latest source and test failures; do not reuse stale counts or assume an old blocker still applies.
Reconcile active assignments first; preserve unfinished legitimate work. Inventory committed capabilities, runnable checks, disabled fixture actions and missing shared contracts.
First priority: executable Runtime baseline and sequential review/integration of existing pinned core, connector, product ranges. Real provider credentials are separate from unit/build acceptance.
Missing live-provider evidence does not block review of executable code. Missing compile/test proof blocks accepted integration. Use an explicit unverified candidate branch if needed.
Establish approved shared signatures and dependency IDs before dispatching dependent work.
Keep a ten-batch horizon per worker as candidates, but fully specify only next batch plus one backup batch. Do not repeatedly rewrite the entire roadmap.

## Batch contract designed for GPT-5.5 High
Each batch targets at least 20 minutes active implementation, normally 20–30 minutes, with 4–6 substantive slices and 2 independent fallbacks. This is a workload/time target, not a guaranteed platform runtime or instruction to idle.
A batch must deliver a usable capability or remove a concrete integration blocker. No trivial files/extra commits to consume time.
For each slice provide:
1. Unique ID: CYCLE-<number>-W<1|2|3>-T<number>.
2. READY/BLOCKED, dependency IDs, base SHA, contract version.
3. Exact allowed paths; source-derived consumed/produced signatures.
4. Concrete behavior and minimal implementation decisions.
5. Test inputs/assertions, exact focused command and expected result.
6. Acceptance, integration destination, fallback and stopping condition.
Do not invent symbols before reading source. Mark already-present work by SHA and replace it with wiring/verification gaps.
Prioritize: current compile/test failures; persistence and real command composition; customer journey wiring; remaining V1 scope.
Parallel tasks must have disjoint paths or explicitly serialized ownership. A READY task has all contracts/dependencies available.
Plan fewer tasks if genuinely complex; do not force six unrelated tasks into a payment/concurrency change.
Workers execute all READY primary slices, then useful declared fallback work if finished early, until target active work or an actual stop condition. Do not stop after a 2-minute edit. Do not continue speculative work merely to hit 20 minutes.
Focused tests per slice; one broader regression per batch unless new shared changes/failures justify reruns. RED locally, GREEN implementation, coherent test+behavior commit. Preserve failing-WIP receipts separately.
Do not reread full history/spec for every slice; coordinator passes bounded context and exact source references.

## Rolling dispatch and integration
Coordinator stores canonical packets on integration:
docs/execution/batches/cycle-<n>-worker-<n>.md
docs/execution/coordinator-ledger.md
Workers store receipts only on their branch:
docs/execution/receipts/worker-<n>-cycle-<n>.md
Packets must be reachable at a pinned GitHub ref/SHA; workers read that ref using GitHub tools without replacing their branch. Coordinator provides an exact retrieval instruction.
Each receipt records start/end SHA, slice IDs, files, actual commands/results, authored-but-unrun checks, active minutes if measured, provider evidence level, exact blocker and next task.
Receipt states are coordination states, not product proof labels: READY, ACTIVE, REVIEW, BLOCKED, INTEGRATED.
On worker completion, coordinator:
1. Refresh branch and verify pinned range/ownership/diff.
2. Review risky semantics and execute focused tests in GPT Runtime.
3. Merge sequentially into integration worktree; resolve shared conflicts centrally.
4. Run combined checks as needed; commit/push accepted integrated result.
5. Record original worker SHAs, resulting integration SHA and test evidence.
6. Immediately issue next source-derived batch; do not wait for all workers unless a real dependency requires it.
Keep at most one completed unintegrated batch per worker. If integration is blocked, supply a bounded independent repair batch rather than unchecked feature expansion.
Use normal merges/checkpoints; no reset/rebase/force-push or main/production/provider mutations without separate authorization.
Existing completed work must not be discarded to adopt this model.

## Coordinator start prompt
You are ServiceDesk AI dedicated Coordinator. Use GPT-5.6 Sol High.
Repository: SaamVR/ServiceDesk. Branch: feat/servicedesk-v1-integrate.
Read AGENTS.md and docs/execution/coordinator-four-chat-20261004.md in full.
Use GPT Runtime Machine only; save all durable progress to GitHub. Never use local devices.
Take over planning/shared-contract/integration ownership from Worker 1. Reconcile currently active tasks without duplicating them.
Inspect fresh heads, current source and actual failures. Restore executable Runtime checks and review existing pinned lane ranges. Prepare three concrete first batches for GPT-5.5 High with the batch contract above, 20–30 minutes active work target, substantial ordered slices and independent fallbacks.
Publish packets/ledger on GitHub and return three ready-to-paste dispatch prompts with exact packet ref, worker branch, first task and tests. Keep ten-batch horizons as dependency-aware candidates.
As receipts arrive, review, test, integrate, save accepted progress and dispatch the next batch immediately. Report concise delivered capabilities/blockers, not planning alone. Never claim a Runtime duration, test PASS or provider proof without evidence.

## Worker continuation prompt
You are ServiceDesk Worker <1|2|3>. Use GPT-5.5 High on your assigned branch.
Read AGENTS.md and docs/execution/coordinator-four-chat-20261004.md.
Fetch the coordinator-issued packet from its exact GitHub ref. Verify your current branch/HEAD/working tree and preserve newer progress.
Use GPT Runtime Machine only; commit/push durable progress to GitHub. No local-device fallback.
Execute the whole READY batch in order, targeted at 20–30 minutes active work. Test, inspect, commit coherent slices and continue; take declared fallback tasks when independently useful. Do not redesign scope or stop after one small edit.
Record any real tool/turn limit or dependency blocker, checkpoint WIP honestly, and publish the receipt with exact SHA/test evidence. Worker 1 does not integrate other lanes. Wait for the next coordinator assignment after the batch; do not self-assign conflicting work.
