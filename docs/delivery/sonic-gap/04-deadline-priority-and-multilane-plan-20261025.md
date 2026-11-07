# SONIC Gap Lane D — deadline-prioritized implementation backlog and lane governance

**Control** [#808](https://github.com/SaamVR/ServiceDesk/issues/808) / [F08 freeze #816](https://github.com/SaamVR/ServiceDesk/issues/816) / original AI-first roadmap. **This is an audit/plan, NOT a change to the feature-freeze contract or Production's current P02 gate.** Any gap implemented outside existing P01–P12 acceptance requires explicit scope change and disjoint Production-authorized ownership.

## Priorities based on business value and critical dependencies

| Priority | Outcome / gap class | Work that can run in parallel | Hard prerequisite / proof required | Owner |
|---|---|---|---|---|
| **P0 now** | **P02 tenant isolation security**; avoid using unsafe staging as feature acceptance | Read-only auth/RLS review, canonical/feature PR diff analysis, reviewer denial corpus, UI source tests | Two controlled fictional owners; explicitly authorized 0065 fix and any shared DB writes, approved V4 deployment, saved RLS denial receipts; [#818](https://github.com/SaamVR/ServiceDesk/issues/818) | Production PROD-02/03/11/12 |
| **P0 now, read-only** | Frozen F01–F08 vs original SONIC and legacy Studio PR audit | Four isolated auditor lanes plus independent QA checker | Canonical/provenance exact-head capture, gap register, no source merges | Feature/audit coordinator |
| **P0 next after P02** | Revenue first journey: catalog + branch price → inquiry → quote → accept | PROD-04 catalog, PROD-05 quote, PROD-06 transactional event journal, independent review | Seed only in approved fictional tenant, quote authoritative values and replay receipt; [#819](https://github.com/SaamVR/ServiceDesk/issues/819)-[#821](https://github.com/SaamVR/ServiceDesk/issues/821) | Production |
| **P0 then** | Crew scheduling → QA/rework → invoice and sandbox ledger | Scheduling/crew, QA/evidence, sandbox finance separated by owned paths | Actual source versions, no collisions, saved completion, consented media and ledger proof; #822/#823 | Production |
| **P0 after prerequisites** | AI Studio/provider + selective F08 merge | UX record picker/inspector, model transport/cancel, saved proposal critic, source PR integration | Dedicated permitted API config, real signed-in owner model call within budget, authoritative saved request, latest canonical CI; [#824](https://github.com/SaamVR/ServiceDesk/issues/824) | Production |
| **P1** | Consent-aware messaging/calendar and model cost accountability | P09 provider adapters, P10 quota vs real token/price monitor, security/ops | Configured sandbox provider, outbox delivery receipt, quiet-hours and consent, immutable pricing ledger; #825/#826 | Production |
| **P1 / release** | Two-tenant UAT and sellable release | QA acceptance, critic/guardian, release/rollback | Two complete isolated journeys, true endpoint/provider logs, explicit deployment authority; #827/#828 | Production |
| **Post-P12 candidate only** | Unimplemented new event/action families and 72-task workflow map | Source schema design and test proposals may be prepared without live activation; implementation needs separately approved change-control | Event journal, atomic writer, audit/capability design, scoped owner authorization, budget and separate milestone | Future feature program |

## Proposed additional specialized lanes (logical partitions, not pretend agents)

- **CTRL-00 Principal integrator:** dependency order, canonical SHA, no PR overlap, acceptance receipts, freeze veto.
- **AUD-01 AI/LLM guardrail:** AI-01/03/04 transport, prompt/citation/cancellation, protected model connection audit.
- **AUD-02 UX/Studio:** AI-02 drafts #631/#633/#645, route and record source UX comparison.
- **AUD-03 Workflow schema:** 5 shipped events/3 actions, 12 new planned events/8 actions and F06 proposal distinction.
- **AUD-04 Domain journeys:** intake/quote/dispatch/QA/finance AI-05–09, saved-source and owner approval gates.
- **AUD-05 Comms/retention/BI:** AI-10–12 consent, provider, daily/weekly data completeness.
- **AUD-06 Critic/finance evidence:** AI-14 provider delivery spoofing, AI_ACTIONS quota vs billed token cost, replay fraud.
- **AUD-07 Red-team release guardian:** cross-tenant/permission escalation, prompt injection, untrusted customer/provider codes, payments/sends, benchmark claims, stale canonical and no-live-proof veto.

Every lane must own distinct files/issues and Git SHAs if implementing. No claim of independently running subagents without tool execution receipts. For source audit, segregated Markdown/JSON/test paths are sufficient and do not constitute feature implementation.

## Next concrete permitted execution packets

**A. Audit acceptance now (zero owner-facing mutation)**
1. Pin canonical SHA and F08 PR head, legacy Studio heads, existing five-event/three-action contract, draft source and 72 task backlog.
2. Publish machine-readable status: `BUILT_CANONICAL_COMPONENT` (foundation only), `PARTIAL_FEATURE` (original AI item missing named acceptance), `MISSING_WORKFLOW_PRIMITIVE` and `UNVERIFIED_LIVE` gates.
3. Run GitHub source/TypeScript/test gate for generated audit artefacts, critic review and one audit issue comment. Do not alter F08 blob manifest or its source freeze.

**B. Production permitted next (blocker-driven, no unauthorized activity)**
1. P02 Production owner obtains *explicit scoped authorizations* for controlled two-account RLS test, reviewed 0065 security fix and target V4 deploy. Keep installed risky definer function blocked from multi-tenant release until proven hardened.
2. Parallel source-only PR reviews while P02 is blocked: review migration diff and PG17 disposable proofs, canonical PR overlap, Studio UI supersession and CI; no repeated pointless live probe or fictional PASS.
3. P03–P07 progressively prove actual saved business value: service pricing, quote acceptance, transaction journal and replay, staff/visit QA, invoice and ledger.
4. P08 select one F08 consolidated merge **or** individually ordered seven PRs, never both. Reverify frozen SHA/blob manifest against new canonical and only merge with Production authority. Integrate Studio source and provider budget.
5. P09–P12 complete authentic provider, platform, two-owner UAT, rollback and explicit release approval.

**C. Deferred feature expansion (requires owner-approved change order)**
1. Event/action T1: `QUOTE_EXPIRED`, `BOOKING_CONFIRMED`, `VISIT_DELAYED`, `INVOICE_OVERDUE` + internal task/approval/reminder/digest — transform F06 source proposals into transactionally verified contracts only after domain journals and migration approval.
2. Event/action T2: remaining eight event triggers and four typed actions, grouped by revenue/fulfillment/finance/retention impact. No arbitrary webhooks, unapproved N8N execution or external send.
3. Map [#173](https://github.com/SaamVR/ServiceDesk/issues/173) 72 tasks one by one to `already in canonical`, `partial`, `genuinely missing`, `unsafe/no authority`, rather than assuming 27 recipe cards mean delivered automation.

## Stop/go scorecard — measurable, not decorative

| Dimension | Verified at audit | Release go/no-go |
|---|---|---|
| Fixed F01–F08 source batches | 8/8 closed, combined PR #841 G0 green at its own exact SHA | Does not prove merge/deploy |
| Complete SONIC AI-01–14 journeys | 14 with partial source; **0 certified original end-to-end** | Require relevant G1–G3 receipts |
| Extended event/action primitive set | 4/12 event proposals and 4/8 action previews, 0 new verified LIVE | New schema/journal/action writer must be approved |
| 72-task roadmap | 72 unchecked issue tasks, 27 draft recipes in canonical | Task-level audited saved event/outcome |
| Canonical feature integration | Frozen PR #841 still OPEN DRAFT, not merged at audit | Production P08 merge only |
| Prod security/provider/business | P02 blocked at audit; credentials/real provider acceptance unknown | No public sellable launch without P12 |
| Runtime efficiency | Tests, source SHA, issue status and overlap are measurable | Never claim a literal 30–90 min autonomous multi-agent runtime |

**No automatic grant of:** migration 0063–0065, shared-DB data writes, paid provider calls, customer messaging, Stripe charges/refunds, canonical/main merges, Render deployment, bulk deletion of SAMAI files or freeze scope expansion.
