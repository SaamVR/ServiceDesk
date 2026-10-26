# ServiceDesk IR14 — F08–F13 Exact-Source Integration Rehearsal

**Control issue:** [#862](https://github.com/SaamVR/ServiceDesk/issues/862) · **Delivery control:** [#808](https://github.com/SaamVR/ServiceDesk/issues/808) · **Feature freeze:** [#816](https://github.com/SaamVR/ServiceDesk/issues/816).

**DRAFT / UNMERGED.** This is a source-only rehearsal, NOT a new F14 feature wave, canonical merge, two-tenant acceptance, infrastructure deployment, commercial provider authorization or feature-freeze reopening.

## Why this exists

Six prior drafts contain substantial verified source but remain unmerged. Their source tests pass in isolation, not together and not as signed-in saved business outcomes. Production, which alone owns canonical integration and actual P02–P12 gates, needs one reproducible compatibility decision. The rehearsal imports exact immutable Git *blob objects*, not recreated versions, onto canonical `d8b77cbb3a62f7187ff79e5ffb0b2b0392d6e2be`.

## Six separate exact source lanes

| Source | PR | Pinned original SHA | Changed paths | Exact-source rehearsal branch |
| --- | ---: | --- | ---: | --- |
| Frozen F01–F07 bundle | #841 | `25ca21486d9f735fceaf9b52691e2ba561224416` | 33 | `sonic-rehearsal/f08-source-20261026` |
| New event/action review previews | #852 | `b10078b520abb4d8623e933d004f5712ef4d2b2d` | 8 | `sonic-rehearsal/f09-source-20261026` |
| Lead triage and field review | #854 | `6b5793653e95a721de82bff7f17f08586c2f016e` | 5 | `sonic-rehearsal/f10-source-20261026` |
| Revenue/quality/resilience review | #857 | `079c13a2f561e82f2a50e828132980b382463448` | 8 | `sonic-rehearsal/f11-source-20261026` |
| Owner saved-workday opportunity UI | #859 | `70bf56d947ceb58d07faa7915ca24b254c254b1c` | 10 | `sonic-rehearsal/f12-source-20261026` |
| Persisted workflow operator evidence | #861 | `7c86ac47576078bd8bdc355d9c37f97edc2980ef` | 7 | `sonic-rehearsal/f13-source-20261026` |

**Provenance:** `docs/delivery/sonic-ir14-exact-source-lock-20261026.json` records source PR, HEAD and Git blob SHA for all **71** file paths. Of these **67 are additive and four are existing UI modifications**, across six disjoint filename sets. Canonical's full tree was independently checked for unexpected filename collisions or missing modifications (none; tree not truncated). The QA lane independently hashes every checked-out source file as a Git object. The critic checks no released workflows, hidden provider claims, branch/tenant bypass, or Git auto-deployment.

## Production merge decision, NOT authorization

**Option A: reviewer picks individual source PRs** #841, #852, #854, #857, #859, #861, with independent current-canonical conflict check and gates. Do NOT merge both the F08 combined bundle #841 and the historical F01–F07 individual PRs; they contain overlapping components.

**Option B: reviewer considers the composite rehearsal source as one DRAFT candidate.** It is not automatically preferred or permitted. If Product/Production later authorizes it, verify source provenance, tenant crosscheck, latest canonical and all exact-merge-head checks *at that point*. Avoid subsequently merging the six original draft PRs again. GitHub Actions success only covers source compilation/tests, not P02 real owner session or merchant workflow output. Keep original PRs and their evidence until Production makes an explicit selection; do not close or overwrite them from Feature Chat.

## Real blocker and required acceptance

- **P02 owner authorization** issue [#818](https://github.com/SaamVR/ServiceDesk/issues/818) remains open. Explicit authorized distinct OWNER-A/OWNER-B current-session and saved membership checks, negative tenant/branch access and one real owner session must be validated by Production. This source rehearsal does not provision owners or access the main Supabase database.
- Real service catalog, priced quote, crew, ledger, transactional accepted-quote journal/replay, workflow publication and external consent-aware provider delivery are Production P03–P12 work, not established by these files.
- **NO LIVE AUTOMATION CREDIT:** original [#173](https://github.com/SaamVR/ServiceDesk/issues/173) 72 automations remain unverified in live operation. These drafts include deterministic reviews and hypothetical previews, not an active automation scheduler or paid model execution.
- ServiceDesk's target is Vercel; `vercel.json` must retain `git.deploymentEnabled=false`. The owner has **NOT** approved a Vercel project/import, preview/staging/production deploy, paid Hobby upgrade, provider spend, secrets changes, messaging, customer/financial data changes, release or cleanup. No action taken on `samvr`/`samai`.
- No migration or GitHub workflow file may be sourced into the rehearsal. No new live-task processing or side effects are introduced.

## Source gates and CI accounting

Source result is acceptable for Production *review* only after all at the exact rehearsal SHA: (1) Git hash lock of all 71 original blobs, (2) original F01–F13 suites all pass together, (3) TypeScript, ESLint and Next production build, (4) review merge-tree parity, (5) independent critic integrity, (6) no scope escape in diff. GitHub Actions on draft PR can validate this with no deployment. Fail closed and repair isolated rehearsal wiring only if any run fails; do not rewrite original PR blobs without a separate explicit proposal.

**NEXT_BATCH:** Production selects source merge option after P02 readiness; Feature Chat must not open another speculative F14+ feature simply to accumulate source count.
