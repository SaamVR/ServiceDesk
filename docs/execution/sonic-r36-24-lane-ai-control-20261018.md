# SONIC R36 — 24-lane AI-first deadline engineering control
Date: 2026-10-18 | Canonical development baseline: 762ec397999008dce8f2216d3d3c2acd778d0858

## Objective
Maximize **real working AI/automation features per GPT execution window** without unsafe shortcuts, duplicated source edits, untested merges or invented connected-device activity. The term "24 lanes" denotes 24 distinct accountable specialist roles and file ownership contracts; it does **not** assert that 24 autonomous developers run simultaneously or that a chat can lengthen the underlying platform runtime limit. A single GPT session can own several real GitHub branches sequentially/parallelize independent reads; separate existing frontend/backend chats preserve exclusive ownership.

## 24 engineering lanes / exclusive ownership
| Lane | Specialist | Primary scope |
|---|---|---|
| C01 | Engineering Control Tower | Priorities, SHA reconciliation, integration sequencing, dependency graph |
| C02 | AI Architecture | Agent contracts, inference lifecycle, non-mutating recommendations |
| C03 | Provider Runtime | Authentication, bounded inference, timeout/cancellation, provider eligibility |
| C04 | AI Extraction & Schema | `src/server/ai/output-guard.ts`, untrusted model schema |
| C05 | AI Citations & Knowledge | Approved-source citations / grounding |
| C06 | Customer Reply Safety | Staff reviewed reply text, protected commercial claims |
| C07 | Intake Copilot | Saved request briefing, missing details, lead classification |
| C08 | Quote Assistant | Saved quote/rate-book proof, exception review |
| C09 | Dispatch AI | Capacity, crew eligibility, safe suggestion |
| C10 | Field QA AI | Saved photos/checklists, incident and rework review |
| C11 | Finance AI | Saved invoice/ledger discrepancy analysis, no payment alteration |
| C12 | Aftercare AI | Saved completion, consent, quiet hours, renewal suggestions |
| C13 | Rule Compiler & What-If | Owner-scope typed draft + synthetic safe preview |
| C14 | Durable Workflow Engine | Event authority, rule evaluation, idempotency |
| C15 | Scheduled Jobs & Dead Letters | Queue leases, retries and owner recovery |
| C16 | WhatsApp Integration | Consent, accepted/sent/delivered/read receipts |
| C17 | Email Integration | Outbox retries, template approval, provider failures |
| C18 | Calendar Integration | Verified availability and idempotent event sync |
| C19 | Billing & Payments | Stripe sandbox, invoice ledger, signed webhook truth |
| C20 | Security & RLS | Two-tenant authority, branch membership, migration approval |
| C21 | AI Studio UX | Owner provider diagnostics, policy preview, workflow inspector |
| C22 | Product & Mobile | Real responsive field apps and customer handoff |
| C23 | **Independent Critic** | Separate branches, malicious-input cases, efficiency and merchant usefulness veto |
| C24 | **Release & Acceptance Guardian** | Exact-head CI, Chrome, PG17, two-owner staging, rollback and evidence ledger |

## Current concurrency contract
- **R36 ACTIVE**: C04 source #698, C05 source #699 (merged), C06 source #700; C23 critic #701/#702; C01/C24 integration. Their real branches and tests—not simulated workers—constitute this runtime's active implementation.
- **R35 RESERVED elsewhere**: owner AI Studio #689/#687; finance #685/#683; QA #682; dispatch #681; frontend #631/#633/#650/#661/#662/#665/#668. Avoid rewriting/merging their open files without reconciliation.
- **Next disjoint source batch**: C07 saved-request deterministic missing-field questions; C12 consent aftercare follow-up review; C14 event version/capacity safety; C23 critic. Pick only slices with confirmed source contracts and non-overlapping files.
- **No imaginary parallelism**: developer count is coordination coverage; real work is measured by committed features, tests, PRs and accepted operational proofs. No automatic cross-chat invocation is implied.

## Long-runtime execution loop
1. Pin the canonical GitHub HEAD, open PR heads and test status. Diff against latest commits before edits.
2. Pick 4–7 independent vertical slices with concrete input/output, owner, forbidden effects, positive and adversarial tests; assign disjoint file sets. Avoid documentation-only batches.
3. Implement substantial code+tests+source receipt per branch; run existing targeted CI and correct actual TypeScript, integration and adversarial failures.
4. C23 runs distinct negative cases, preferably a separate critic PR into the candidate; producer repairs and tests are merged into the candidate before release review.
5. C24 reviews final head's full source, parity and critic checks. Merge reviewed PRs sequentially to the current canonical dev branch; rerun canonical exact-head Chrome/PG17 only after coherent integration. Limit needless GitHub Actions duplication.
6. Publish a factual status: canonical SHA, exact PRs merged/open, passed/failed/pending run IDs, feature usefulness, real owner proof versus source-only, remaining blockers.
7. Repeat with remaining ready disjoint lanes until the current turn/runtime actually ends; do not promise autonomous background continuation.

## Hard gates
- Samai Codex public synthetic inference was verified once; that is **not** multi-tenant commercial API authorization or deployed ServiceDesk signed-in inference.
- No Render production promotion or gateway credential upload. Staging migrations and two-owner merchant acceptance still require separate explicit authorization, source/DB reconciliation and approved readiness.
- AI may prepare suggestions, never mark charge paid, assign a crew, send provider messages, or publish rules without exact saved authority and human/policy approval. Nonexistent provider delivery or financial records are not success.
