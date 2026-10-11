# ServiceDesk V3 — New-chat verified multilane handoff
Verified: 2026-10-11, Asia/Dhaka. Created after read-only GitHub, Supabase migration, samvr and samai checks.

## Do not lose these exact heads

- Repository: `SaamVR/ServiceDesk`; V3 coordinator/integration `feat/servicedesk-v3-coordination-20261011`.
- **Latest checked coordinator HEAD before this docs-only handoff:** `337a37eeecf7473ad4c685387f850a62ab5436a9`. It is **two documentation-only commits** after the last accepted code SHA. Recheck at start; this handoff commit will advance it again.
- **Latest accepted application CODE SHA:** `58ad5a4c2a42ca2da0ab601f471c77d32df1e594`. Exact-head [combined CI run 38124750936](https://github.com/SaamVR/ServiceDesk/actions/runs/38124750936): **SUCCESS**, 30 focused files/207 passing tests; full 375 files/**1,603/1,603 tests**; TypeScript PASS; ESLint 0 errors/11 warnings; Next build PASS (32/32 generated pages); Node release smoke PASS.
- W4 frontend branch `feat/servicedesk-v3-ui-overhaul-20261011`: head `9cf139ab6b604e499cdcbbb5c78076ee2d89f0ae`, [PR #83](https://github.com/SaamVR/ServiceDesk/pull/83) **OPEN, mergeable, not merged**. [UI CI 38126544800](https://github.com/SaamVR/ServiceDesk/actions/runs/38126544800) PASS on that exact head. UI approval, owner-reviewed screenshots, live signup/operations journey, and browser proof NOT verified. W4 Git tree has **none** of the four needed `src/app/api/` WhatsApp/AI/inbox routes.
- `main`: `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`. Old V2 integration `feat/servicedesk-v2-integrate`: `188080381c0f64e38690e68f2319413b3358cc0a`. Old V2 multilane `feat/servicedesk-v2-multilane-20261006`: `5be389feb0bd0661df637780ef2e7d61071c459c`. Do NOT promote or merge old branches by accident.
- Other open PRs #80, #74–#67 and #21 are historical nested/stale branch lines; inventory before acting. Do not assume they are ready to merge.

## Real integrated code (not yet a deployed commercial product)

- [PR #98](https://github.com/SaamVR/ServiceDesk/pull/98): tenant-scoped staff AI invocation and live active service-catalog reference, opt-in durable signed WhatsApp delivery status conditional PostgreSQL updates.
- [PR #99](https://github.com/SaamVR/ServiceDesk/pull/99): same-origin bounded AI draft HTTP handler; no auto-send.
- [PR #100](https://github.com/SaamVR/ServiceDesk/pull/100): explicit staff-approved, source-message/version/consent/idempotency-enforced reply queued through the existing transactional Postgres RPC, plus real delivery triage read.
- [PR #101](https://github.com/SaamVR/ServiceDesk/pull/101): prevent branch-private delivery triage from leaking workspace-wide volume.
- [PR #102](https://github.com/SaamVR/ServiceDesk/pull/102): fix mismatch: already-applied SQL `servicedesk_enqueue_conversation_reply` payload lacks `messageId`. `createPostgresConversationReplyIntentResolver` binds exact outbox to a unique STAFF message through `messages.outbox_event_id`, validates current recipient/consent, suppresses stale customer replies, retries temporary DB failures; delivery triage distinguishes provider ACCEPTED from DELIVERED/READ via durable outbox evidence.
- [PR #103](https://github.com/SaamVR/ServiceDesk/pull/103): retry of a confirmed reviewed reply after network timeout/version increment reuses an exact matched persisted receipt; no second enqueue for the same idempotency key.
- No connected live WhatsApp or other provider acceptance receipts, production deploy or owner-approved browser visual test were generated in these backend runs. Source/build contracts only. AI draft is non-executing. Outbox sending/worker needs safe controlled real scheduler wiring.

## Data and release gates

- Connected Supabase project `cpmmgivhlkfbiwzhlcey` migration history was checked READ-ONLY again on 2026-10-11: last applied **`sd_0036_v2_commercial_direct_cost_schema`**. [Issue #75](https://github.com/SaamVR/ServiceDesk/issues/75) remains OPEN; **0037–0059 not applied**. Do not bypass migration policy/owner gate; no unauthorized production data writes.
- Owner-reported SMTP sender `no-reply@ezcomo.shop`; authenticated verified-email signup-to-workspace receipt remains unproven. Owner registration should stay disabled until schema and live confirmation pass.
- WhatsApp durable status and AI runtime are disabled by default; real Meta HMAC/delivery, email callback, Stripe sandbox, Calendar OAuth, outbox worker and browser evidence require separate controlled validation. Never confuse provider acceptance with actual delivery/read.
- Old Render preview may be stale; do not claim it runs the verified V3 SHA. No protected `main`, V2, production DB or service credentials were modified in this handoff.

## Read-only device reconciliation — CRITICAL preservation

The user asked for a minimal device audit despite older repo instructions favoring GPT Runtime only. Connected Desktop Commander reported:
- **samvr** online, but a bounded `find /home/ubuntu -maxdepth 5 -type d -name ServiceDesk` returned **no matching checkout**. This is NOT a proof that no repository exists elsewhere; do not assume or delete anything.
- **samai** online. Existing checkout `/home/ubuntu/work/servicedesk-controller/ServiceDesk`, branch `feat/servicedesk-v2-profitability-summary-2b4c-20261006`, local HEAD **`bc92158c718505581a317fbd33d562177359b7fb`**. `git status --short`: **seven locally modified/staged files**: `src/contracts/commercial.ts`, `src/features/commercial/CommercialBillingWorkspace.module.css`, `src/features/commercial/CommercialBillingWorkspace.tsx`, `src/features/commercial/commercial-finance-runtime.ts`, `src/server/core/commercial-profitability-postgres.ts` (A), `tests/db/v2-commercial-profitability-postgres.test.ts` (A), `tests/e2e/v2-commercial-profitability-product.test.ts` (A). Local tracking status `+1 -0` against its *locally fetched* `origin`. **GitHub current remote head for the named branch differs: `b7b8973795b137b79b7f963646a33901b6186e3e`**. The local commit may be unpushed or remote tracking stale; reconcile safely before ANY V2 work. DO NOT reset/clean/rebase/force-push/overwrite/stage/commit the user’s local work without checking its authorship and intent. It is NOT part of the accepted V3 baseline.
- This audit used one bounded read-only command per online device; no device repo changes. Reserve any future device use for a demonstrated GPT Runtime limitation (real browser/device-specific provider proof), with scope and approval; prioritize GitHub-hosted CI for reproducible checks.

## Launch-oriented multilane map

**Coordinator / Integration (single owner):** owns V3 branch, `src/contracts/**`, package + lockfile, shared exports, `.github/workflows/**`, global ledger/taskboard, branch assignment, conflict resolution, exact-head CI and staging release evidence. Refresh HEAD and worktree status before every merge. New chat must use GPT Runtime Machine for checkout/edit/test/build when accessible; never pretend the GitHub connector provides a Runtime shell.

**Lane L1 — Core, Auth, schema:** `src/domain/auth/**`, `src/server/core/**`, migrations and `tests/db/**` (but exclude specifically coordinator/other-lane-owned files). First batch: read-only resolution of 0037 blocker, safe ordered migration plan with actual owner/platform authorization gate; Auth/verified email registration E2E contracts and strict tenant/branch negative cases. No unsafe migration execution.

**Lane L2 — Durable outbox execution:** exclusive `src/server/jobs/**`, `src/server/integrations/outbox/**` and specifically delegated outbox tests. First batch: real service-role runtime composition `claimReady -> createPostgresConversationReplyIntentResolver -> ConnectorOutboxExecutionPort -> per-channel dispatcher -> complete_outbox_event` behind disabled-by-default worker flag; lease/idempotency/consent/terminal/suppression handling, mixed-topic fail closed; one synthetic full job execution regression; no live sends by default.

**Lane L3 — Provider callbacks and connectors:** `src/server/api-handlers/provider-*/**` or exact provider handler files, `src/server/integrations/whatsapp/**`, `src/server/integrations/email/**`, related provider tests; do NOT modify `outbox/**` while L2 owns it. First batch: controlled signed WhatsApp GET/POST handler, durable status callback receipt and delivery ordering evidence, authenticated provider mapping, bounded error responses, then Resend delivery callback. Coordinate W4-owned Next routes; avoid live callbacks until approved.

**Lane L4 — AI assistance:** `src/server/ai/**` and non-overlapping `src/server/api-handlers/ai-*.ts` provider/AI tests. First batch: operational staff AI draft with real current catalog, reviewed handover / no automated send, prompt-injection/PII minimization, disabled/consent guards, durable replay proof. No AI-proposed business mutation.

**Lane L5 — W4 frontend (independent PR #83):** exclusive `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`, with explicitly assigned UI tests. First batch: add four thin server routes (no duplicate auth/HMAC): `GET/POST src/app/api/providers/whatsapp/route.ts`, `POST src/app/api/internal/ai/draft/route.ts`, `POST src/app/api/internal/inbox/reply/route.ts`, `GET src/app/api/internal/inbox/delivery/route.ts`. Connect Inbox draft -> staff review/edit -> QUEUED/EXISTING -> provider ACCEPTED -> DELIVERED/READ/FAILED/SUPPRESSED, truthful empty/loading/error states. Apply senior-level UI/UX. Capture real Chromium 320/390/834/1280/1440 viewport artifacts and get owner visual approval before merging. Do not rewrite W4's latest SHA without reconciliation.

**Lane L6 — Quality / staging proof:** exclusive `tests/e2e/**` and browser/CI evidence files assigned by coordinator; `.github/workflows/**` edits only via coordinator. First batch: action-runner headless Chromium journeys, mobile/desktop screenshots and artifacts, mock provider acceptance and auth tenant isolation. Real-browser screenshots/evidence only, never invented. Prefer GitHub-hosted isolated actions to RDC, without GitHub Actions polling loops. Redact PII.

**True parallelism:** Use separate GPT Runtime worktrees / independent chats with explicit activated tasks; merely drawing six lanes is not six concurrently executing agents. Keep disjoint files, pinned base SHA, and contract handshake. If independent chats cannot be started directly, produce six immediately usable dispatch prompts rather than claiming they are running. Integrate completed work as each lane finishes; don't wait for slowest lane.

## Time-efficient sustained execution rules

- No run spent solely auditing/planning. For each 20–30-minute **active-work target** per worker batch, aim for 3–6 substantial related implementation slices, source tests, 1 reviewed PR with a durable GitHub commit, and one independent fallback task. This is a workload target, not a guaranteed tool run length.
- One initial fast audit: exact SHA + `git status --short` + latest PR tests + already-implemented symbols. Then CODE. Do not keep re-checking the same green CI. When a failure appears, read only failed job lines; fix and rerun exact-head.
- Run focused checks locally in GPT Runtime. Prefer **one** full GitHub Actions RC per coherent PR/merged integration boundary, not repeated full Actions after every tiny change. One combined coordinator RC after multiple meaningful merges. Store full run URL, commit SHA, counts. Documentation-only commits must not retrigger costly acceptance checks.
- Each lane receipt: exact base/head, files, tests, API/schema contract, real progress vs mock-only, blocking dependency, next 2 slices. Accepted labels only `IMPLEMENTED`, `CONTRACT_TESTED`, `PROVIDER_VERIFIED`, `OPERATIONS_VERIFIED`, `CONFIGURATION_BLOCKED`.
- Protect `main`, V2, production DB, payment/email/WhatsApp providers, API tokens and secrets. No force-push/reset; explicit approval before irreversible/live actions. Allow synthetic test evidence to establish CONTRACT_TESTED, never PROVIDER_VERIFIED.
- Reports concise (50–150 words), every meaningful 20–30-minute milestone with concrete SHAs/test URLs, avoid massive logs/browser tabs, minimize browser RAM/CPU; no false background work promises.
- Starting priorities: implement L2 actual worker composition and L5 four routes, L1 schema/auth gate, L3 controlled Meta status proof, L6 real browser screenshots, and L4 AI review safety. Continue beyond first small patch in each active run.

## Source material

Read `AGENTS.md`, `docs/execution/coordinator-four-chat-20261004.md`, this file, `docs/execution/v3-real-outbox-reply-provider-evidence-verified-20261011.md`, `docs/taskboard.md`, and fresh W4 PR #83 before coding. Historical V1 coordinator branch names in the four-chat packet are **not** the current V3 destination; use exact current V3 ref above. Resolve any difference with user’s latest runtime/device instructions explicitly and never bypass safety gates.

## 2026-10-11 final refresh — W4 advanced while packaging this handoff

**W4 frontend NEWER observed HEAD:** `55989922716c440de42962cb8ffeb91995578c77` on `feat/servicedesk-v3-ui-overhaul-20261011`, still [PR #83](https://github.com/SaamVR/ServiceDesk/pull/83) **OPEN**. Its exact-head [GitHub Actions run 38128517105](https://github.com/SaamVR/ServiceDesk/actions/runs/38128517105) is **SUCCESS**. Compared with earlier `9cf139a`, nine additional commits touch `OperationalProductRoute.tsx`, `inbox-triage.ts`, `invoice-collection-queue.ts` and corresponding V3 E2E tests: explicit failed/suppressed outbound recovery warnings/queue semantics and safe integer minor-unit manual-collection amount handling. **Do not discard these improvements.** The latest W4 tree still has **none** of the four WhatsApp/AI/internal Inbox Next route shims; no owner-reviewed screenshots or live browser/operator/provider acceptance was proved by these commits. Recheck the moving W4 head again at startup—this snapshot may advance.

**Moving W4 branch second refresh (snapshot, NOT a frozen ref):** next observed HEAD `495b6d77880aadf18885725083832d315dd3b733`, [CI 38128622022](https://github.com/SaamVR/ServiceDesk/actions/runs/38128622022) **SUCCESS**. Three additional commits after `5598992` improve status-/currency-aware collections ordering so USD and EUR minor-unit balances are not compared as if interchangeable, with E2E regression. W4 is actively committing; do not keep polling or overwrite its HEAD. Refresh *once* when actually integrating. All earlier W4 snapshots are historic.
