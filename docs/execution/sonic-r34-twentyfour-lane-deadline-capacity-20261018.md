# ServiceDesk SONIC R34 — 24-lane deadline capacity (AI-first)

Pinned dev HEAD at dispatch: `c9ecc6aa2a50132c9c07eb882eac9897e2557a4e` · 2026-10-18, Asia/Dhaka. Supersedes the *capacity* section of the [R33 15-lane manifest](sonic-r33-fifteen-lane-deadline-manifest-20261018.md); existing AGENTS.md and coordinator ownership rules still govern integration. **Named lanes are work partitions, not separately executing AI agents or an actual 24-person team.** A single runtime should orchestrate as many disjoint *implemented, reviewed and checked* lanes as tool capacity supports; do not claim launches.

## L01–L15 preserved
L01 AI provider and latency; L02 intake/record revalidation; L03 quote authority (other chat #645); L04 safe model-to-workflow compiler; L05 owner metrics; L06 dispatch; L07 quality; L08 event engine; L09 durable jobs/journals; L10 communications; L11 finance; L12 Calendar; L13 frontend/AI Studio (other chat #631/#633/#650); L14 independent critic; L15 integration and release. No double ownership of active branch files.

## Nine additional dedicated specialist lanes (L16–L24)
| Lane | High-value feature target | Own only these kinds of files; release dependency |
|---|---|---|
| L16 AI Evaluation & Red Team | Real model output fixture corpus, prompt-injection defenses, hallucinated status/amount regression; `tests/ai/evals/**` additive, never writes source under L01–L05 |
| L17 AI Tool Authorization | Workspace/branch/role enforcement for model tool proposals; `src/server/ai/tool-orchestration.ts` and additive `tests/ai/tool-authorization/**`; release requires L14 negative tests |
| L18 Knowledge & RAG | Versioned, cited rate book/service FAQ retrieval and stale document invalidation; `src/server/ai/catalog-knowledge.ts`, `citation-guard.ts` (only when L04/L03 disjoint) |
| L19 AI Observability/Spend | Redacted request ID, latency, tokens, per-tenant quota alerts, hard budgets; additive AI telemetry paths; no user content in metrics |
| L20 CRM & Recurrence | Real lead lifecycle and recurring-service trigger state; `src/server/core/recurrence/**`, `tests/domain/recurrence/**`; SQL requires L15 approval |
| L21 Approval Workflow | Durable human gates for customer messages, pricing, finance, field exceptions, no implicit provider sends; additive workflow approval modules |
| L22 Scheduling/SLA | Timezone-aware reminders, late visits, waitlists, schedule revalidation; explicit persisted evidence and lease safety |
| L23 Retention & Growth | Consent-aware aftercare/reviews/referral recommendations from saved history; drafts only until messages approved |
| L24 Merchant UAT & Reliability | Independently reproduce signed-in owner A/B, billing/quote/visit chain, provider outage, rollback and latency; `docs/release/uat/**`, targeted E2E under L15 coordination |

## What counts as a 'big team'
- **24 owned vertical specialties** available; only **4–7 simultaneously active implementation branches** when file owners and CI capacity are demonstrably disjoint; one coordinator and one separately branched L14 critic. If there is only one execution context, no claim of asynchronous workers.
- Activate at most two related slices per lane per burst, prioritize actual end-to-end functionality over superficial AI cards. Target 4–8 tested behavioral changes per sustained session, without asserting platform runtime can be extended beyond its hard limits.
- Merge via L15 sequentially, rechecking canonical head, PR base and exact SHA. Do not force-merge other conversations' drafts or bypass forbidden GitHub authorization. Every PR needs relevant focused tests, exact-head source RC and critic/parity verdict.
- GPT Runtime/connected GitHub only. Existing automatic PR CI can verify branches; avoid repeated manual GitHub Actions dispatch and never use local Samai/Samvr for development. No connected migration, Render promotion, unapproved provider token or customer send.
- **P0 production blockers**: V4 isolated authorized deploy, migrations 0063–0065, two fictional owner sessions, exact persisted request→quote→acceptance→workflow→visit→invoice→ledger, actual signed-in Samai inference and separate commercially valid AI provider authorization.

## Current R34 batch owner assignments and actual evidence
- L01 recovery: [#658](https://github.com/SaamVR/ServiceDesk/pull/658) and independent [#659](https://github.com/SaamVR/ServiceDesk/pull/659), staged as checked candidate (review permission must be checked before canonical merge).
- L06 dispatch timing truth: [#660](https://github.com/SaamVR/ServiceDesk/pull/660), source candidate (dedicated CI).
- L07 field quality visit identity: [#664](https://github.com/SaamVR/ServiceDesk/pull/664), source candidate (dedicated CI).
- L14 independent critic: seek malformed dates, cross-tenant reuse, falsified feedback, unauthorized delivery and historical replay.
- L15 integrated release: no source candidate may be labeled OPERATIONS_VERIFIED without authorized real owner/browser/provider/DB proof. Do not interrupt another chat's #650/#645/#633/#631 ownership.

## Continuous efficiency reviews
Every run record: baseline SHA, branches touched, **merged vs candidate** counts, new tests and negative cases, latest exact-head CI result, critic discoveries, source tests vs live business truth, actual CI minutes when observable, and exact next dependency. If merges are blocked by permission, preserve reviewed candidates and inform operator rather than bypassing access.
