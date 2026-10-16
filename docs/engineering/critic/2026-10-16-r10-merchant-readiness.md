# CRITIC-R10 — Real merchant acceptance versus green source CI
Observed on 2026-10-16. This is a separate **in-chat critic workstream** on an isolated audit branch, not an independently started human or autonomous worker.

## Exact-source evidence
- At R10 start, canonical source `54b01a7520084e5289819ed684b230f5f855690f`. Exact full source/Chrome [38931237372](https://github.com/SaamVR/ServiceDesk/actions/runs/38931237372), PG17/worker [38931237364](https://github.com/SaamVR/ServiceDesk/actions/runs/38931237364) and review merge-tree parity [38931242979](https://github.com/SaamVR/ServiceDesk/actions/runs/38931242979) **PASS** at the same SHA.
- Current isolated Render review remains **R8** commit `3bea4f105fb6d7771d38653d1d12d634e80fd687`, with [actual LIVE SHA and guest-route gate 38928375768](https://github.com/SaamVR/ServiceDesk/actions/runs/38928375768) PASS (attempt 3). Review and canonical are deliberately separate; no R9/R10 deployment asserted.
- [Draft R9 review PR #519](https://github.com/SaamVR/ServiceDesk/pull/519) remains pending. Do not force-reset the review branch, silently merge a newer controller SHA or manually promote Render solely to inflate delivery count.
- Connected Supabase migration inventory ends at `sd_0062_v4_branch_trigger_rowtype_guard`. Migration 0063 **not installed**; no new database or production action has been approved or performed.

## Read-only connected database check
A read-only aggregate query observed:
| workspace | active services | active USD branch price books* | requests | quotes | workflow executions | invoices | outbox events | outbound messages |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |

*The query counted active branch price-book records, not currency-filtered rows; because the count is zero, USD active records are also zero. No row content, PII, credentials or customer message was read.

## Critic's acceptance findings
1. **P0: source QA is not merchant QA.** A verified Chrome synthetic operations run or database fixture is not proof an authorized owner can save pricing, create a genuine quote, accept it, see a causally linked internal attention record, and read back an invoice under tenant isolation. [Issue #487](https://github.com/SaamVR/ServiceDesk/issues/487) remains OPEN. No quotes, workflow executions, invoices or provider/outbox records exist in connected stage.
2. **P0: no second isolated fictional owner/workspace is established.** A genuine tenant-A/B negative test needs two explicitly authorized fictional accounts with separate workspaces, not one session impersonating another in mocked hooks. Do not provision tenant/user credentials or mutate this connected database without explicit authorization.
3. **P1: prevent fake acceptance certificates.** [QA PR #521](https://github.com/SaamVR/ServiceDesk/pull/521) adds an **offline operator-supplied aggregate preflight**, checks exact live source identity and safety prerequisites, and enumerates remaining business workflow steps. Its status is never `REAL_UAT_PASS` and its `acceptanceVerified` property is always false. Since inputs are operator declarations, it is not a signed read-back or live Supabase test. Tests are source/contract evidence only.
4. **P1: AI advisory grounded actions.** [Draft #516](https://github.com/SaamVR/ServiceDesk/pull/516) extends limited language filtering for client/lead/team outreach. CRITIC-R10 review identifies indirect phrasing such as `ask staff to email clients` and `send a reminder to leads` which cannot be comprehensively stopped by the current word-pattern. The feature generates text advice, not actual sends, so this is a **suggestion-quality gap, not evidence of unauthorized delivery**. Expand adversarial tests and prefer narrow structured recommendation types. Do not bypass previous integration safety blocks.

## Actionable next UAT journey (requires explicit authorized fictional identities and permitted staging mutation)
1. Confirm live `/health.sourceSha` exactly matches the pinned review candidate; keep production and external sends OFF.
2. With fictional owner A, configure an active USD cleaning branch; save actual approved test prices via Settings first-run action and read back all three service codes/rate-card/branch-price-book rows after reload.
3. Enter fictional request facts using authenticated application routes; obtain saved quote ID, line items, integer-minor totals, deposit, expiry and persisted status through the quote engine, with reload/retry and invalid-input controls.
4. Transition quote only with its permitted human authorization. With internal automation explicit opt-in, read back source journal/execution and causally linked attention action, not unrelated seeded rows. Leave 0063-dependent recovery disabled.
5. Verify invoice lifecycle and tenant read-back separately; neither quote accept nor internal attention proves a charge or customer delivery.
6. With unrelated fictional owner B, test negative access to owner A’s workspace, quotes, conversations, attention, invoices and outbox.
7. Collect controlled paid AI/provider receipts only after separate operator approval, within a non-production sandbox. Never infer receipt from mocked success.

## Multilane operating rules
- Product/UI owns owner setup, route and browser evidence; Core owns tenant SQL/finance/persistence contracts; Connector/AI owns suggestion grounding and provider contracts; Controller owns shared CI and review promotion. CRITIC owns this report and objections, not implementation approvals.
- Work on distinct branches and file ranges, pin SHA for every source test, and preserve current controller and review branch histories.
- Measure merged critical behavior and real acceptance outcomes, not agent labels, token count or short PR cycle time.
- Completion classifications: `IMPLEMENTED`, `CONTRACT_TESTED`, `PROVIDER_VERIFIED`, `OPERATIONS_VERIFIED`, `CONFIGURATION_BLOCKED`.
- Current merchant acceptance: **CONFIGURATION_BLOCKED**. Even a successful offline preflight is not a provider, RLS or commercial PASS.
