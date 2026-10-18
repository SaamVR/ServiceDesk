# SONIC R38 — 32-lane AI-first deadline engineering expansion
Date: 2026-10-18 | Canonical start: `00a46ac904a14d47e38609f1b7f46e6cc977e106`

## Model
The existing 24 lanes in `docs/execution/sonic-r36-24-lane-ai-control-20261018.md` continue unchanged. **Lanes are engineering ownership slots, not running autonomous agents.** This expansion adds eight concrete workstreams C25–C32 to avoid assigning 24 lanes to the same broad AI intake/automation modules. Each active branch has one editor, a test outcome and an independent critic.

| Lane | Dedicated role | Disjoint primary output | Activation |
|---|---|---|---|
| C25 | Owner Inbox Response Evidence | Tenant-authorized complete saved conversations, outbound delivery vs unanswered inbound, safe owner escalation; `src/server/ai/owner-inbox-review.ts` | ACTIVE PR #718 |
| C26 | Approved Knowledge Retrieval | Bounded, approval/version/citation-qualified tenant RAG retrieval; `src/server/ai/knowledge.ts` | ACTIVE R38 |
| C27 | AI Cost & Latency SLO | P50/P95 job timings and spend budgets, redacted receipts, no guessed billing | NEXT |
| C28 | Multilingual AI Intake QA | Real Bangla/English intent variants, safety corpus; no automatic customer send | NEXT |
| C29 | AI Evaluation & Regression | Golden fictional merchant transcripts, hallucination / unauthorized-action assertions | NEXT |
| C30 | Source Completeness & Drift | 2-owner saved-read cap/second-read freshness evidence, zero unverified task counts | NEXT |
| C31 | n8n Rule Export Security | Signed owner-approved export contracts, typed webhooks, never unrestricted LLM-generated JS | NEXT |
| C32 | Business KPI Efficacy Critic | Measured review reduction, missed-lead recovery, cost/latency benchmarks, independent release veto | NEXT |

## Existing lane assignments
C01–C24 remain in R36; in-flight frontend #631/#633/#650/#661/#662/#665/#668/#687/#689, recovery/dispatch/quality #681–#685, photo #706 and workflow review #716 are RESERVED to their originating owners. Do not rewrite, merge, or force-push those branches from this lane. This chat owns only new C25/C26 plus the coordinator C01/C24, with C23 separate adversarial test branches. Additional slots become active only with a scoped issue/branch and executable tests.

## Deadline mode: simultaneous discovery, serialized safe Git history
1. Check latest canonical SHA and overlapping PRs. Batch read-only file discovery in parallel, assign 2–5 substantive disjoint source+test slices.
2. Every branch gets exact schema/authority checks, real callable functionality, focused negative tests, and an explicit owner-use case. Avoid creating features as documentation-only or screenshot-only demos.
3. Independent C23 critic writes separate adversarial branch and candidate-base PR, vetoes false receipts/PII/tenant leaks. Merge critic tests into candidate *before* accepting source.
4. Honor existing PR CI as release evidence; run consolidated exact-HEAD full source/Chrome and PG17 after integration. CI green is not a signed-in owner test.
5. No local RDC needed for GitHub/CI. Production Render R13, protected connected Supabase (previously installed through 0062), credentials, provider sends, payments, migrations and unrelated customer data are not changed without separate authorization.
6. Record actual delivered per turn: verified merged PRs, canonical SHA, exact CI runs and conclusions, defects found by critic, saved-owner/browser readiness and blockers.

## AI feature delivery priority
- **P0:** AI Studio review/publishing controls and real signed-in Samai gateway use with supported provider entitlement and isolation; preserve separate UI chat ownership.
- **P1:** Trusted owner Inbox triage and limited source RAG/citations, approved quote/dispatch/quality/finance agent proposals, human review and no hallucinated live effects.
- **P2:** Typed automation rules with durable event journal, retry/owner replay, source-attached audit evidence and approved communication actions.
- **P3:** Multilingual expansion, forecasting and measured ROI; not before dependable first merchant journey.
