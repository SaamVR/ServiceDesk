# ServiceDesk AI — Throughput Recovery and Three-Lane Execution Packet
Date: 2026-10-04
Status: IMPLEMENTED planning/workflow correction; application integration and runtime checks remain pending.
This packet governs the next planning/execution cycle. Preserve existing product scope and AGENTS.md ownership. Existing run numbers are historical identifiers; use E01–E10 below to avoid conflicting Run 7 instructions.

## Verified diagnosis
Observed heads (refresh before execution):
- Core: 5fe26c81e6ba61971f602a373be437c96115d400
- Connectors: c3940e6ba2ac1c344e8cf3674f453a6663c46ee4
- Product: d8ecc6331d30e81bd2098688877389d988b973e3
- Integration: c618903e4fb4300bb4c8dd2be761180300d854a0
Comparisons against integration reported core 61, connectors 249, product 214 commits ahead, each 3 behind. Counts are snapshots, not measures of completed features.
Integration still contains foundation facade interfaces and scaffold; it lacks the compared lane implementation files.
Product src/features/request-intake/RequestSummaryPreview.tsx imports sample data and disables its action because ServiceDeskFacade.updateRequest is not integrated.
Product docs/presentation/shared-interface-requests-20261004.md requests missing shared DTO/read contracts.
Connector docs/handoffs/chat2-run6-payment-connector-hardening-checkpoint-20261004.md reports tests NOT RUN, CONNECTOR_TEST_ENV_BLOCKED_ENOSPC; samai disk full, samvr missing Node/pnpm. Its next Run 7 differs from docs/handoffs/chat2-next-10-sustained-runs-20261004.md.
Core docs/taskboard.md records multiple tasks waiting for executable tests/database proof.
Root cause hypothesis supported by these files: throughput into usable software is limited by integration, runnable checks and unresolved shared interfaces. Longer prompts alone cannot resolve these dependencies.

## Operating strategy
Use GPT-5.6 Sol High for one planning pass in EACH existing chat, if available. It produces ten executable batches for its lane from fresh source, then switch that chat to GPT-5.5 High for execution. This is a requested allocation, not a benchmark claim. Model selection is operator-controlled; this document cannot change a chat model.
Keep exactly three active development lanes. Chat 1 is also the sole integration writer. No additional supervisor chat required.
A planning pass must make exact task decisions; workers should not repeat architectural planning each turn.
Do not freeze all ten batches as READY: freeze the next two against observed contracts; later batches remain dependency-gated candidates. Reconcile only affected batches after a contract change.
Target 20–25 minutes active work per batch, but never sleep or invent tasks to fill time. Runtime cannot be guaranteed. Completion is measured by accepted capabilities and integrated journeys.
Commit a coherent tested behavior plus its tests together. Do not push separate deliberately failing RED commits. Run the RED check locally, implement GREEN, inspect, commit. Do not split doc edits/imports/tests into many commits to inflate output.
Run focused checks per slice; run the broader regression once per batch or when shared changes justify it. Avoid repeating unchanged full suites.

## First priority: executable integration baseline
Chat 1 E01 is first. Chats 2/3 can plan and work independently in their owned paths while it runs.
1. Refresh all branch heads and read AGENTS.md, contracts-v1.md, taskboard and this packet.
2. Establish a clean isolated scratch worktree based on current integration. Preserve concurrent progress. No reset/rebase/force-push. No main, production database or deployment changes.
3. Inspect disk free space, Node version, pnpm availability and package cache. Use GPT Runtime when usable. If an already-authorized alternate device is used, inspect before acting; never delete user/project files to recover disk. Use a fresh scratch workspace or available supported runtime; document the precise blocker if unavailable.
4. Review pinned lane diffs and merge core, connectors, product sequentially into the integration worktree. Resolve shared conflicts centrally, preserving substantive changes and evidence. Run focused checks after each. Do not publish an integration ref as verified if checks did not run.
5. Run pnpm install --frozen-lockfile, pnpm typecheck, pnpm test, pnpm lint, pnpm build. SQL files require actual PostgreSQL/Supabase execution separately; Vitest tests/db does not prove SQL/RLS.
6. If executable checks are impossible, preserve an explicitly UNVERIFIED candidate on a new integration-candidate branch, not as accepted integration. Name commands/errors. Set an environment recovery task as priority, rather than growing indefinite unchecked code.
7. Publish the tested integration checkpoint and source lane SHAs. Publish exact facade/read contracts needed next; reject or defer each shared interface request explicitly.
8. Workers adopt that checkpoint through normal merges coordinated with the controller; preserve their newer commits. Do not cherry-pick overlapping entire histories or overwrite branch trees.

No provider credentials are required for compilation, unit/contract checks and local application startup. Missing live-provider proof does not block integration of code that passes these checks. Real provider actions and database proofs remain separate acceptance gates.
Do not claim CONTRACT_TESTED for newly authored tests that did not execute. Record IMPLEMENTED, tests authored, tests NOT EXECUTED. Historical prior evidence must name its SHA and command.

## Ownership and dependency protocol
Chat 1: migrations, contracts, domain, server/core, server/jobs, domain/DB tests, shared config/barrels and integration/taskboard.
Chat 2: server/ai, server/integrations, provider API handlers and AI/provider tests.
Chat 3: app routes, features, components, styles, public assets and UI/browser tests. Provider route wiring must coordinate with Chat 2; handler internals stay Chat 2-owned.
Only Chat 1 edits shared DTO/facade definitions, package/lockfiles, global taskboard. Workers update lane-specific execution ledgers.
Every shared request lists required signature/DTO fields, existing consumer path, test case and blocking task. Chat 1 responds with accepted version or explicit deferral in its next batch.
Worker commit range ready for integration is pinned at a SHA. Later worker progress continues independently; controller never merges a moving unreviewed target.
After every worker batch, Chat 1 reviews/integrates the pinned range during its next cycle. If two batches accumulate unintegrated, workers prioritize wiring/compatibility gaps instead of expanding unrelated features.
Workers blocked on one task take a declared independent fallback. No duplicate helper implementation or cross-lane edits to bypass dependencies.

## Planner deliverable contract
Save docs/execution/chatN-plan-e01-e10.md and docs/execution/chatN-ledger.md in your own lane.
For EACH of ten batches include:
- observed branch/base SHA and relevant contract version;
- one business capability outcome;
- 3–5 substantial ordered slices, each with task ID and READY/BLOCKED status;
- exact existing files to modify and proposed new files with responsibility;
- exact current symbols consumed and output signatures; read source before naming them;
- tests: inputs, expected behavior, command and pass criterion;
- dependency task ID and independent fallback;
- integration destination and executable wiring acceptance.
Include unchecked test commands as commands TO RUN, never evidence.
Inspect current implementation first. Mark already-present work with SHA; remove it from queue. Do not reimplement transports/recovery already present merely because an older plan names them.
Keep E01/E02 executable; later batch rows below are sequencing candidates requiring source-derived details before execution.
Planning ends with a small manifest validator/self-check: unique IDs, all dependencies exist, ownership matches, no READY task with unmet dependencies, every outcome has executable acceptance.
No need to build a generic orchestration framework to enforce this packet.

## Ten-batch sequence — Chat 1 core/controller
Each row names three deliverables to expand into exact source-derived tasks.

| Batch | Outcome and slices | Existing ownership anchors / acceptance |
|---|---|---|
| E01 | Restore executable checks; sequentially combine pinned lanes; publish tested baseline and integration ledger | package.json, docs/taskboard.md, all reviewed lane diffs; typecheck/test/lint/build run, exact SHAs |
| E02 | Resolve DTO/read requests; compose real authenticated core facade; expose request/quote server entry points | src/contracts/**, src/server/core/facade.ts, requests.ts, request-repository.ts, quote-facade.ts; unauthorized/cross-workspace denial and persisted request-to-quote |
| E03 | Finish operations persistence; atomically apply verified payment to ledger/booking/outbox; durable review persistence | src/server/core/operations.ts, visits.ts, supabase/migrations/0004_ledger_outbox_attention.sql; duplicate/mismatch/expired-hold checks with DB proof |
| E04 | Durable job claiming; bounded retry/lease recovery; cancellation stop conditions | src/server/jobs/**, src/server/core/**; two workers cannot send same committed job, restart resumes pending work |
| E05 | Inbox/conversation storage and takeover; outbound command authorization; message delivery read snapshots | contracts + core + migrations; takeover prevents AI send, duplicate inbound persists once |
| E06 | Crew assignment and job transitions; checklist/evidence persistence; manager-reviewed completion | visits.ts, visit-repository.ts, domain/operations.ts; crew scope denial and incomplete checklist rejection |
| E07 | Basic recurring visit generation; skip/pause/resume commands; crew capacity checks per occurrence | capacity.ts, capacity-repository.ts, migrations; recurrence retry no duplicates, occupied slots not allocated |
| E08 | Invoice balances and authorized manual payment; quality case lifecycle; attention ownership/deadlines | operations.ts, contracts/migrations; financial totals from ledger, version conflict rejected |
| E09 | Permission-filtered reports; platform billing separation; workspace usage enforcement | domain/core/jobs; two-workspace isolation, subscription never credited to customer invoice |
| E10 | Integrate all accepted ranges; DB/RLS/concurrency plus complete journey checks; operations release packet | taskboard + operations docs; enquiry-to-paid-job acceptance, unresolved gates explicitly listed |

E02–E10 depend on tested integration and available approved spec. If a proposed behavior already exists, wire/test it instead. Do not broaden recurring or payment scope beyond approved V1.

## Ten-batch sequence — Chat 2 connectors/AI
Current transports and matrices already exist. Prioritize their runtime composition.

| Batch | Outcome and slices | Existing ownership anchors / acceptance |
|---|---|---|
| E01 | Audit existing exports/tests; repair compile/behavior failures; pin coherent connector range for integration | src/server/integrations/index.ts, src/server/ai/index.ts, tests/providers/**; focused suite actually runs |
| E02 | Compose durable inbound parser/store; hand off normalized event to processor; verify mixed batch duplicate behavior | api-handlers/provider-whatsapp-durable.ts, whatsapp/inbox-persistence.ts, inbound-normalization.ts; no event lost or duplicated |
| E03 | Compose outbound dispatcher with configured transport; enforce takeover/template/consent race policy; map status to durable update command | whatsapp/outbound-dispatcher.ts, configured-adapter.ts, status-batch.ts; queued/accepted/delivered distinct |
| E04 | Compose OAuth token store boundary; create/update/cancel booking events; connect stale-sync rebuild/reconciliation | google-calendar/configured-adapter.ts, rest-client.ts, rest-sync.ts; repeat dispatch produces one event, reconnect failure actionable |
| E05 | Connect server-authoritative checkout; verified callback-to-core command bridge; payment review/recovery outcomes | payments/stripe-checkout.ts, application-state.ts, review-bridge.ts, api-handlers/provider-stripe.ts; duplicate/mismatch cannot falsely confirm booking |
| E06 | Compose existing email transport/templates/suppression; persist send receipts through approved store; retry policy | email/transport.ts, templates.ts, callback-policy.ts; suppress-before-send, transient failure retry |
| E07 | Complete configured model transport; validate extraction/tool proposals; integrate intake/handover through core facade | ai/extraction.ts, orchestrator.ts, provider-gate.ts; model cannot set prices/payments/roles, malformed output fails safely |
| E08 | Wire signed webhook executor/n8n example; durable retries and dead-letter; operational failure summaries | webhook/executor.ts, examples/n8n/booking-confirmed.json, recovery/**; restart-safe dedupe and bounded retries |
| E09 | Controlled provider verification tasks; reconnect/error paths; actual redacted receipts | docs/provider-operations-checklist.md, integration evidence builders; credentials/consent required, no fixtures counted as proof |
| E10 | Cross-provider business journey/recovery; export consistency cleanup; controller-ready closure matrix | tests/providers/**, tests/ai/**, handoff; exact tests/SHAs and unresolved configuration gates |

Independent fallback for E09: repair unexecuted tests/imports, compose approved store adapters, or close a documented integration gap. Do not create fake receipts. Existing historical Run 7 email work may finish first if currently active; reconcile that progress into these tasks rather than interrupting/duplicating it.

## Ten-batch sequence — Chat 3 product/UI
Stop growing fixture-only previews when the needed facade is available. Wire existing components.

| Batch | Outcome and slices | Existing ownership anchors / acceptance |
|---|---|---|
| E01 | Inventory disabled/fixture actions; map to requested contracts; repair build and browser-load failures | features/**, presentation/shared-interface-requests-20261004.md, tests/e2e/**; concrete blocker per action |
| E02 | Auth/session route boundaries; persistent request create/edit; quote display from server snapshot | app/b/[slug]/enquire/page.tsx, features/request-intake/**; reload preserves request, denied writes show useful state |
| E03 | Shared inbox server reads; human takeover/reply commands; delivery/failure status UI | features/inbox/**, app/app/[workspace]/inbox/page.tsx; sent message state comes from server/provider receipt |
| E04 | Quote approval/acceptance commands; slot hold and checkout redirect; expired-hold recovery | features/quotes/**, features/schedule/**, features/checkout/**; actual quote-to-checkout journey, no client pricing authority |
| E05 | Confirmed booking/customer portal; reschedule/cancel policy UI; Calendar sync/error visibility | app/portal/**, features/integrations/**; refresh shows persisted visit, failed calendar action remains visible |
| E06 | Crew job detail/authorized transitions; checklist/photo upload through signed storage path; completion error recovery | app/crew/**, features/crew/**; assigned crew only, actual uploaded evidence, manager review state |
| E07 | CRM/property editing; basic recurrence controls; communication preferences persist | features/crm/**, properties/**, preferences/**; edits survive reload and stop unauthorized sends |
| E08 | Invoice/payment views; attention/recovery actions; quality case handling | features/invoices/**, recovery/**, quality/**; command results/version conflicts reflected honestly |
| E09 | Reports/billing/onboarding settings; connector readiness; mobile/accessibility pass | features/reports/**, billing/**, onboarding/**, settings/**; actual snapshots, keyboard/mobile journey |
| E10 | Same-product guided tour; screenshot/presentation refresh; real browser journey evidence | app/tour/**, app/presentation/**, presentation docs; no fixture claims promoted to live verification |

Vitest files under tests/e2e are not automatically real browser tests. Inspect framework. Record browser automation/manual browser evidence separately, with URL and integrated SHA. Chat 1 approves any browser-test dependency/package change.

## Execution prompt — paste into each GPT-5.5 High chat
Continue ServiceDesk AI in your assigned lane. Read docs/execution/throughput-recovery-20261004.md and your source-derived chatN-plan-e01-e10.md. Verify branch, current HEAD, working tree and contract compatibility; preserve all newer progress.
Execute the next batch: complete its ordered 3–5 substantial slices and then available fallback work within the batch. Target 20–25 minutes active implementation without idle waits. Do not end after a status message or one trivial edit. A turn limit may force a checkpoint; keep the unfinished task explicit.
Inspect required source once, run independent reads together, implement coherent behavior, execute focused tests, inspect ownership/diff, commit tested behavior with tests, and continue. Push coherent checkpoints; controller integrates pinned ranges. Broader regression runs once per batch unless a new failure/shared change requires it.
Missing credentials block provider verification only; missing contracts block dependent wiring only. Switch to a declared independent task. Unavailable tests remain NOT EXECUTED, never PASS/CONTRACT_TESTED. Stop uncontrolled unchecked expansion and prioritize getting checks working.
Do not redesign scope, write new speculative helpers, or repeat already-present work. Report briefly: batch, start/final SHA, delivered capabilities, test commands/results, integrated versus branch-only, precise blocker, next task ID.
Chat 1 additionally integrates pending reviewed worker checkpoints as its first priority each cycle. Chats 2/3 do not edit shared contracts or each other's files.

## Planning prompt — paste once into each GPT-5.6 Sol High chat
Act as the planner for your current ServiceDesk lane, preserving current work. Read this packet and inspect fresh repo source, AGENTS.md, approved spec/plan, current heads and counterpart interface requests.
Create docs/execution/chatN-plan-e01-e10.md with ten source-derived batches using the planner deliverable contract above. Freeze the next two batches; later batches carry explicit prerequisites. Remove already-implemented tasks, name exact signatures and tests from observed source, and maximize completed working capabilities per batch.
Chat 1 also schedules integration/environment recovery before further unchecked expansion and resolves the shared-interface queue. Chat 2 plans composition of existing transports with approved stores and facade. Chat 3 plans replacing fixture previews with actual server-backed actions.
Update only your lane plan/ledger; Chat 1 owns global taskboard. Commit and push the plan. End with the exact GPT-5.5 execution instruction and first task ID. Do not claim implementation or runtime guarantees from planning.

## Acceptance of this workflow correction
- This packet exists on integration and each lane, preserving newer code.
- Source-backed diagnosis and distinct E batch IDs remove ambiguous Run 7 instructions.
- Chat 1 owns executable baseline, contract decisions and continuous integration.
- Planning candidates are not falsely marked READY or implemented.
- Actual successful application integration, executed tests and live providers remain pending until evidenced.
