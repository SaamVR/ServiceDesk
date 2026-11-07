# ServiceDesk SONIC — V1 release execution reset (2026-11-07)

**Classification:** execution plan and read-only control, NOT owner permission for database, Auth, providers, hosting, billing, customers or canonical merges.

**Authority:** [delivery control tower #808](https://github.com/SaamVR/ServiceDesk/issues/808), [two-chat contract](https://github.com/SaamVR/ServiceDesk/issues/808#issuecomment-6510726968), production [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818) → [P03 #819](https://github.com/SaamVR/ServiceDesk/issues/819) → P04–P12; [72-task register #173](https://github.com/SaamVR/ServiceDesk/issues/173) and [scope audit #846](https://github.com/SaamVR/ServiceDesk/issues/846).

## 1. Hard truth and new definition of progress

The fixed F01–F08 (and later F09–F10) **source-only** batches are done. The product is **not** sellable, P01 is the only closed production batch, P02 has **2/7** checked acceptance items, and P03–P12 are unaccepted. Draft [#915](https://github.com/SaamVR/ServiceDesk/pull/915) contains protected AI/Inbox/quote/job/booking sources but is not canonical, deployed or live-UAT proof. Original 14 AI journeys lack complete end-to-end owner acceptance, and 72 automation business tasks are not accepted as LIVE. The connected ServiceDesk Supabase project `cpmmgivhlkfbiwzhlcey` was last observed **INACTIVE**. Vercel is the future target but no authorized ServiceDesk project/deployment has been demonstrated. Original F23 atomic hold release has a **proven unsafe sibling-quote phantom** on disposable PG17; neither F23 activation flag is approved.

**Single release objective:** two distinct authenticated fictional cleaning businesses independently complete owner onboarding → saved service/branch prices → inbound request → server-priced saved quote → human review/acceptance → crew/visit/QA → invoice/authorized internal workflow action, with tenant isolation and durable readback. Provider-backed AI, email, WhatsApp, calendar, payment sandbox, platform billing and sellable Vercel hosting require their own positive acceptance gates before being advertised. Never call a review draft a delivered message, a source fixture a saved business action, or a green unit test a live owner journey.

**Product metric per runtime:** count of newly **accepted business transitions** at a recorded exact SHA with saved evidence, negative cases, and the next unblocked prerequisite. Source commits and test counts are engineering inputs, not the product KPI.

## 2. Two-chat architecture and strict WIP budget

- **Production Readiness Chat is DRI for P02→P12,** including stage choices, real Auth/JWT/browser/RLS, owner pricing, integration decisions, SQL/migration ledger, provider acceptance, Vercel permission and all canonical merges.
- **Feature Chat** may correct **one** named source blocker and **one** callable owner-journey source at a time in the existing reviewed draft chain. No F27+ speculation, branch explosion, duplicate source bundle merges or resetting historical receipts. No connected DB, tenant, Auth, provider, money, customer, Vercel, Render or canonical write.
- Each chat has **at most two newly active deliverables**, with a **single shared-file integrator** and distinct DBA/security, frontend, backend, adversarial QA and independent critic review *roles*. A “lane” is an accountable partition, **not a continuously running independent model**. A lane with no work/testing receipt is not counted as active.
- Keep **one nominated successor feature stack** (currently #915 lineage; older #841/#884/#909–#913 are candidates needing explicit inclusion/supersession decisions) and **one Production integration path**. Compare exact blobs before cherry-picks. Never import component PRs and a composite that already contains them.
- Treat F23 as **disabled/deferred** unless a product/DBA review establishes it is essential to the V1 buyer journey. F23's candidate SQL stays UNAPPLIED, `SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED=false` and `SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED=false`. The incomplete quote uniqueness fix cannot be installed from this plan.

## 3. Release critical path — sequential acceptance, parallel preparation only

| Gate | Owner-usable observable output | Independent exact evidence required | Current |
| --- | --- | --- | --- |
| **P01** environment/source lock | reviewed starting integration state | approved issue checklist | issue CLOSED |
| **P02** owner tenant isolation | OWNER-A and OWNER-B individually sign in, recover session, create/select own workspace and branch, foreign owner denied | two distinct real signed-in browser/JWT sessions, RLS own/foreign rows and default-branch RPC, sanitized DB readbacks at exact deployed SHA; real negative paths | **BLOCKED_OWNER, 2/7** |
| **P03** service and pricing | owner enters cleaning catalog and branch-scoped active price book; revises it safely | saved service, rate/card/book, currency, version/CAS conflict, authorizing actor and branch readback; signed-in browser | queued until P02 |
| **P04** enquiry and quote | inbound enquiry becomes authorized request, saved priced quote, reviewed/accepted | saved request/quote, pricing source, owner approval, rejection/expiration/foreign denial | queued |
| **P05** durable automation | accepted quote produces exactly one journaled internal attention/work execution | atomic source event, replay/restart/idempotency, negative tenant and duplicate tests, saved action rows | queued |
| **P06** crew, visit, QA | approved slot/crew and completed field work | conflict/availability readback, real authorized saved visits/QA, guarded recurrence; disabled unsafe F23 path | queued |
| **P07** invoices and ledger | authorized invoice and reconciliation | saved invoice/payment ledger, sandbox provider evidence if claimed, denial/rollback and zero phantom money | queued |
| **P08** AI Studio | owner actually requests source-grounded model suggestion and reviews it | approved commercial model key/budget, actual controlled call, stale/tenant refusal, no auto-send | queued |
| **P09** communications/calendar | real consent-aware sandbox delivery/sync where explicitly approved | signed provider callbacks, recipient consent, retry/dead-letter, calendar conflict and receipt truth | queued |
| **P10** SaaS operations | owner trial/plan limits, uptime/cost monitoring and recovery | allowed billing scope, redacted logs, restore drills, verified backups and spend caps | queued |
| **P11** two-business acceptance | entire same-SHA two-owner product path and negative tests | browser/mobile/DB/PG17/critic/canonical RC and rollback artifacts | queued |
| **P12** approved sellable launch | compliant Vercel release or honest NO-GO | project+SHA+environment owner approval, appropriate commercial plan, migration ledger, smoke, monitoring, rollback, final sign-off | queued |

**Acceptance state vocabulary:** `NOT_STARTED`, `SOURCE_IMPLEMENTED`, `INTEGRATED_SOURCE`, `STAGING_VERIFIED`, `OPERATIONALLY_VERIFIED`, `RELEASE_APPROVED` plus `BLOCKED_OWNER`, `BLOCKED_TECH`, `REJECTED`, `SUPERSEDED_REVIEWED`. `CI_GREEN` is **never** a product completion state.

**Partial vs final release:** The first internally demonstrable milestone is P02–P05 completed end-to-end on the same safe staging application; next P06–P07 complete the core cleaning business loop. But **P12 remains the mandatory sellable release gate** under the existing owner's fixed plan; do not quietly omit P08–P11 or substitute an unauthorized reduced MVP. A narrower commercial MVP requires a distinct owner-approved scope revision.

## 4. P02 owner decisions blocking all real deployment work

**Do not silently infer consent from “continue,” “use Vercel,” or this plan.** Production must request affirmative permission for a bounded, reversible staging trial:

1. **Environment and cost:** exact existing Supabase/staging target, whether the inactive primary database may be reactivated, isolated synthetic workspace/fixture policy and cleanup/rollback; never create or modify production data without explicit scope.
2. **Identity:** explicitly permitted separate OWNER-A and OWNER-B controlled QA identities/mailboxes and purpose; secure credentials/JWTs through local secret storage only, never GitHub comments or chat.
3. **Hosting:** exact `Samvrc` Vercel project/team, branch/SHA, **staging** deployment audience, rollback and budget; keep `git.deploymentEnabled=false`, verify no Git-linked auto-preview, and resolve Hobby commercial restrictions before sellable public service.
4. **Provider scope:** AI inference, Meta/WhatsApp, email, calendar and payment sandbox credentials only in separately approved phases, with explicit budgets and recipients. No real charges or external contacts from development assumptions.

The read-only P02 harness already exists: `scripts/release/v4-p02-two-owner-readonly-acceptance.mjs` (actual OWNER JWTs required), and offline adversarial tests exist separately. **Six offline tests are not two live owner sessions.** A successful read-only RLS audit alone is not browser onboarding completion.

## 5. Runtime execution protocol — stop inefficient loops

**Start / 10% target:** fetch #808, #818, #819, exact canonical/main + active PR SHA and latest relevant CI. Run `node scripts/release/sonic-critical-path-gate.mjs` with a GitHub read-scoped token when available, or use live GitHub connector issues. It returns *issue-checklist* state only, NEVER a verified live SaaS signal.

**Execute / 65–70% target:** if P02 permission is pending, choose at most **one** directly unblockable source fix or integration defect; otherwise report `BLOCKED_OWNER` and the minimal owner decision rather than inventing F27+, tests or docs. If authorized, execute P02 real owner/browsers/RLS first; P03 source preparation may occur in a disjoint lane but cannot claim completed business data. Every code change must map to a specific P-gate acceptance sentence.

**Integrate / 10–15% target:** one reviewer maps changed paths to a single nominated PR; preserve previous SHAs and production-owned files, never rewrite historic manifests to make a test appear green. Use the repo's GitHub Actions/runner infrastructure; remote desktop only if functionality is out of connector/workflow scope, respecting device quota.

**Verify / 10% target:** one focused Node/Vitest/TypeScript/denial run for changed source, **one** consolidated full RC/PG17/Chrome/critic at stable integration HEAD. Reuse exact-SHA CI only when HEAD unchanged. After at most 2–3 repeats without a new hypothesis, stop and log actual root cause. An unavailable run ID is `CI_UNVERIFIED`, not PASS.

**Report:** exact GitHub SHA, changed paths, checks actually run, **business capability delivered**, P02–P12 status, current operational veto, 1–2 next prioritized tasks, responsible lane and owner scope needed. No promise of background execution or more autonomous agents than tools actually ran.

### Drift kill switches

- **STOP feature expansion** after two consecutive runs with zero new business-journey acceptance (unless one newly diagnosed P0 security defect requires immediate protection). The next run must target live authority/integration or report blocked.
- **STOP** if active deliverables exceed two, duplicate old source is re-imported, overlapping PR chains proliferate or combined full CI runs are repeated at unchanged SHA.
- **STOP and escalate** if anyone calls a source/mock/issue checkbox “live business acceptance,” advances P03 while P02 unresolved, installs F23 candidate, triggers unapproved deploy, processes real money or contacts customers.
- Never close P02/P03/P12 checkboxes on CI-only evidence. Record all blocker escalations in #808; avoid another run that merely regenerates the same plan.

## 6. Accountable next work — not speculative features

**NEXT_BATCH=P02 #818; Production owner:** secure scope authorization, then execute distinct real owner A/B browser/JWT/RLS test against approved staging, record sanitized per-owner saved receipts and test denied foreign reads. **Feature owner:** do not expand F23; respond only to a proven P02/P03 integration defect or the next approved saved-business vertical slice. **DBA/critic:** review F23 uniqueness only if it is unavoidable for V1; original release veto remains.

**Release gate CLI:** `node --test scripts/release/sonic-critical-path-gate.test.mjs` is offline and safe; `GH_TOKEN=<read-scoped token> node scripts/release/sonic-critical-path-gate.mjs` performs 13 GET-only GitHub requests (P01–P12 plus PR #915) and emits no issue bodies, secrets or tenant details. If GitHub is unavailable or the issue data is incomplete, it refuses a readiness claim.

**Launch decision:** `NO_GO` until real P11 acceptance, separate Vercel commercial/owner permission and P12 sign-off. The goal is a paid product with verifiable outcomes, not a count of green scripts.
