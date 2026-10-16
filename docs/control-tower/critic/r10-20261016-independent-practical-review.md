# ServiceDesk V4 R10 — independent Critic, user-value and throughput review

**Evidence date:** 2026-10-16; repository `SaamVR/ServiceDesk`; release control branch `feat/servicedesk-v4-reconciled-qa-shell-20261012`.

The Critic is a **separately scoped review workstream within the same ChatGPT conversation**, not a separate human or permanently running agent. It comments on implementation PRs while Product, Core/Provider and AI lanes use disjoint files. Approval requires an observed failure scenario, a negative regression, a nonregression control, and a status distinction between source CI, installed SQL, live review and actual merchant UAT.

## Reconciled starting baseline

- Canonical R9 `54b01a7520084e5289819ed684b230f5f855690f` passed [full source RC 38931237372](https://github.com/SaamVR/ServiceDesk/actions/runs/38931237372), [PG17/worker 38931237364](https://github.com/SaamVR/ServiceDesk/actions/runs/38931237364) and [review-source parity 38931242979](https://github.com/SaamVR/ServiceDesk/actions/runs/38931242979).
- Render isolated review is **LIVE on older R8** `3bea4f105fb6d7771d38653d1d12d634e80fd687`, not R10; [R8 live guest/health CI](https://github.com/SaamVR/ServiceDesk/actions/runs/38928375768) passed.
- [Draft R9 review-source PR #519](https://github.com/SaamVR/ServiceDesk/pull/519) preserves exact canonical tree in GitHub's virtual merge; remains not released. Migration 0063 is not applied.
- Connected staging last read-only count: one workspace, no catalog/branch price books, one request, no saved quotes/invoices/workflow executions. Evidence is not two-owner or priced merchant UAT.

## Independent lane evaluations (review-notes also posted directly to each PR)

| Lane / PR | Previously observed failure | Specific regression demand | Operator-value hypothesis | Critic release verdict |
| --- | --- | --- | --- | --- |
| Product [#522](https://github.com/SaamVR/ServiceDesk/pull/522) | Today's waiting KPI counts invalid SENT quotes but omits expired/unknown APPROVED, contradicting Quotes workspace and owner priorities. | One SENT expired + two APPROVED invalid must yield three validity-review tasks; invalid APPROVED never counted as ready to send; headline/detail consistent. | Staff can spot blocked approvals without navigating Quotes; no silent backlog. | Source change and dedicated critic checks; **full exact-head RC is the required gate; not authenticated browser-tested** |
| Backend [#523](https://github.com/SaamVR/ServiceDesk/pull/523) | Missing message `createdAt` rendered epoch 1970; missing sender/direction silently became STAFF/OUTBOUND. | Missing/invalid identity, actor, timestamp and provider delivery-state values fail closed in snapshot/inbound/reply; legitimate installed SQL timestamp passes; provider HTTP 200 nonregression. | Operators no longer see fabricated staff-message chronology and receive actionable fetch errors instead of false records. | Installed function definitions inspected read-only; **full RC and signed-in tenant UAT separate** |
| AI [#524](https://github.com/SaamVR/ServiceDesk/pull/524) | First-person guard rejected "we sent" but allowed passive fake completion "invoice was paid" and "customer received". | Reject completed-action declarations without matching saved command receipt; preserve safe suggestion "Review the saved request before sharing". | Owner and staff can trust that suggested text is advisory, not a simulated payment/delivery confirmation. | Rule-based static validation only, **not a paid-model performance study** |
| Merchant release [#521](https://github.com/SaamVR/ServiceDesk/pull/521) — another development lane | Exact CI and Render health were being conflated with signed-in revenue/automation usefulness. | Offline preflight always `acceptanceVerified:false`; even all-positive operator-supplied aggregates demand independently witnessed two-owner sessions, quote/invoice readback and provider receipt. | Avoid premature commercial launch and identify concrete real setup tasks. | Source-only; its specialized workflow uses synthetic merge checkout unless pinned to source SHA. |

## What must be independently proven, in order

1. **Source contract**: exact pull request HEAD, existing mandatory full `pnpm check:rc` + TypeScript/lint/build, targeted negative/positive tests, Critic source-trust CI and merge-tree parity.
2. **PostgreSQL/RLS contract**: separate PG17 source recovery; installed helper/migration parity, two isolated fictional owners and denied cross-tenant reads. Never alter real customers or apply 0063 without a distinct review.
3. **Review-deploy contract**: require manual isolated review promotion only after authorization; exact merged Render LIVE SHA, `/health` source identity, unauthenticated public routes and signed-in product behavior.
4. **Practical owner journey**: authorized owner adds actual business-approved USD price book, saves request, checks real quote lines/expiry/deposit, verifies invoice/readback and internal automation attention. Real send/payment side effects disabled; do not invent prices.
5. **Business effectiveness**: task-completion time, count correctness, staff misprioritization, failed steps, and customer delivery/readback clearly separated; models' suggested advice judged against source evidence, not prose plausibility.

## Throughput and quality findings

- **Accelerate meaningful engineering** with small disjoint feature PRs and independent Critic comments, parallel CI, and early fixture-vs-installed-SQL checks. Integrate completed heads independently; do not wait for a slow unrelated lane.
- **Do not bypass release coverage for speed**. PR [#520](https://github.com/SaamVR/ServiceDesk/pull/520) proposed skipping full source CI on docs-only changes but failed established mandatory full-PR gate; Critic rejected and closed it unmerged. Existing full-source policy stands.
- **No inflated completion claims**: source green != Render LIVE != signed-in multi-tenant UAT != provider delivery/payment != commercial readiness. A redacted aggregate is advisory and cannot independently prove user actions.
- Each lane should record negative and positive results and GitHub workflow URL on its own PR, with failed runs explicitly preserved as evidence of correction rather than silently discarded.

**R10 source PRs should remain unmerged until each exact-head full CI has passed.** The independent Critic document itself cannot certify any UAT.
