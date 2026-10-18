# SONIC-DEADLINE R35: expanded 24-lane AI-first engineering capacity

Baseline 2a4fecf708226e6d7d610b5ad05797f1e5a2bc6f, 2026-10-18. Extends `docs/execution/sonic-r33-fifteen-lane-deadline-manifest-20261018.md`. **24 named lanes are a work/ownership organization, not 24 automatically launched workers or guaranteed parallel execution.** Every implemented slice must have an actual branch, source, tests and exact verified CI.

## Active coexisting integration
The V4 canonical development branch has #673 authorized model-suggested workflow and #675 owner HTTP access merged and green (#39080629964 app/Chrome, #39080629956 PG17). Product UI owners have open #631,#633,#645,#650,#661,#662,#665,#668. Do not edit their owned paths or merge their drafts automatically; merge with coordinator and exact HEAD revalidation. No V4 live production or shared commercial AI provider permission.

## Additional specialist lanes (L16–L24)
| Lane | Ownership and actual deliverables | Current release wave |
|---|---|---|
| L16 Finance AI exception review | Additive `src/server/ai/invoice-exception-review.ts` plus tests; grounded saved invoice ledger anomalies, manual owner review, no charges | R35 ACTIVE #677 |
| L17 Owner AI context + privacy | `src/server/ai/owner-context.ts` + provider status tests, verify metrics and suppress untrusted provider callbacks | R35 ACTIVE #676 |
| L18 Workflow AI dry-run preview | Additive `src/server/ai/workflow-what-if-preview.ts` + tests; real evaluator, explicitly fictional preview with no effect | R35 ACTIVE #678 |
| L19 Visit follow-up scheduler | Future bounded trusted visit/event timeline recommendations, quiet-hours and opt-in controls | NEXT |
| L20 Recurring service intelligence | Future saved service-cycle and consent-reviewed renewal suggestions | NEXT |
| L21 Field QA integration service | Read exact saved visit/checklists/photorefs, authorize owner and double-check versions; cannot auto-approve | NEXT |
| L22 AI evaluation + spend observability | Golden synthetic test corpus and bounded provider latency/cost audits; no raw conversation log | NEXT |
| L23 Operational provider reconciliation | Durable outbox/accounting and clear accepted/delivered/sent separation | NEXT; connector owner |
| L24 Release/merchant acceptance evidence | Coordinator-owned two fictional tenants, role barriers, PR exact-head release scorecard and rollback readiness | NEXT; permission gated |

## Main team lanes L01–L15 from R33 remain
L01 provider, L02 intake, L03 quote, L04 rule compiler, L05 owner operations, L06 dispatch, L07 field quality, L08 event identity, L09 durable journal, L10 messaging, L11 finance ledger, L12 Calendar, L13 UX, L14 independent critic, L15 integrator and release guardian. New lanes cannot concurrently edit their parent lane's files: L16 is an additive AI module rather than L11 payment mutation, L18 adds a wrapper rather than changing L04 compiler.

## Parallel wave protocol, without waste
1. Refresh current canonical head, open PR ownership and red/green evidence; assign **3–6 disjoint actual writable PRs per wave**, not 24 speculative pseudo-workers.
2. Build 2–4 related substantial features per lane, with synthetic tests and negative cases. Prefer trusted saved business facts and actual safe owner workflows over static role cards.
3. Distinct L14 critic branch injects adversarial cases (cross tenant, raw provider PII, forged model tool fields, hidden attrs, fake paid/sent, stale source). Producer repairs, then critic PR merges into candidate; critic cannot approve its own change or merchant readiness.
4. CI: use already configured GitHub pull request workflows and focused domain gate, not launch duplicate manual fan-out; exact-head full source builds before merges. Integration branch runs app/Chrome and PG17 after sequential review merges.
5. Measure actual throughput (merged source features, tests passing, CI failed/fixed, real merchant journey, risks unresolved) and stop only at genuine blocker. Preserve WIP PR if a runtime ends with CI running; never call it PASS.
6. No access to local devices when connected runtime/GitHub sufficient; no secrets in logs, no provider sends, production promotion, unsupported personal Codex commercial use, real payments or DB migration without separate operator authorization.

## Critical release conditions
Commercial AI: public Samai synthetic inference HTTP 200 is not multi-tenant provider clearance. Stage V4 separately; provision securely and run authorized owner+other-tenant cases. Install SQL 0063–0065 only with database change approval, run real saved quote→invoice→attention→workflow reconciliation, then apply restricted runbooks. `main` and R13 remain out of scope in source development. R35 features #676–#678 are backend candidates until CI and actual owner consumer are present.
