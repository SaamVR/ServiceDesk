# R12 independent Critic: functional relevance, false-positive tests and engineering efficiency

Repository: SaamVR/ServiceDesk. Date: 2026-10-17 (Bangladesh). This Critic is a separate **in-chat engineering lane**, not an independently running agent, human review, or a second chat.

## Verified release baseline

- Controller baseline after R11 Product: `5a045b04f099eac34f4fb723fb3c3a4bda4fe01c`; source and PG17 recovery CI both PASS ([full RC 38983247642](https://github.com/SaamVR/ServiceDesk/actions/runs/38983247642), [PG17 38983247519](https://github.com/SaamVR/ServiceDesk/actions/runs/38983247519)).
- The isolated LIVE Render review `9753888afd4ab015907c33839b62f6ffd8082a24` is older and not R12. Its [guest/health real Render exact SHA gate](https://github.com/SaamVR/ServiceDesk/actions/runs/38982592703) passed. R12 changes here are only source PRs.
- Migration 0063 is OFF. Merchant acceptance still needs active approved USD pricing, a second unrelated fictional tenant, saved quote/invoice/workflow evidence, and controlled provider acceptance; staging source fixture checks cannot substitute for UAT.
- Earlier R11 Finance [#532](https://github.com/SaamVR/ServiceDesk/pull/532) and Critic report [#534](https://github.com/SaamVR/ServiceDesk/pull/534) have source RC PASS but their merger tools reported safety blocks. Do not work around these blocks or assert integrated finance identity from them.

## Adversarial feature reviews

| Lane and PR | Previous real source defect | Independent negative + positive checks | Benefit and remaining risk |
| --- | --- | --- | --- |
| AI [#539](https://github.com/SaamVR/ServiceDesk/pull/539) | `OwnerOperationsBriefFacts` carries queue counts only, yet an existing test approved `Review critical attention items tomorrow.`; count-only finance facts also permit unsupported overdue claims. | Reject relative deadlines (today/tomorrow/EOD/COB/next week/at noon) and ungrounded delinquency/overdue suggestions; permit human source-queue reviews with no invented time. Verify owner-only authorization and stale-read behavior remains unchanged. | More dependable owner decisions. Regex phrase rejection cannot guarantee full semantic coverage, and no paid-model study was performed. |
| Product [#540](https://github.com/SaamVR/ServiceDesk/pull/540) | Equal highest non-superseded quote versions are arbitrarily selected based on the SQL row order, potentially marking an offer approved/current for staff send. | Permute conflicting row order; exclude both from current/send targets; count *affected requests* once; surface manual version reconciliation; latest single higher version restores current; older superseded duplicate is harmless. | Staff cannot unknowingly send an arbitrary conflicting quote. Need future SQL uniqueness/owner AI summary consistency and signed-in UX verification. |
| Finance pending [#532](https://github.com/SaamVR/ServiceDesk/pull/532) | Optional coerced invoice IDs can fabricate a persisted identity. | Source tests passed earlier but merging was blocked; do not substitute another branch or tool to force integration. | Still pending source integration. |

## Independent Critic objections and improvement plan

1. Model evidence must be explicit: without dueAt/appointments do not supply relative dates, and without persisted payment due dates do not call invoices overdue. A future structured, evidence-tagged recommendation type is preferable to unbounded natural-language denial patterns.
2. Quote conflict protection must surface an actionable task, not merely drop records from counts. Existing `buildQuotePipeline`/Today/Quotes consistency is a nonregression requirement. Even a valid `APPROVED` status is not proof of reconciled saved line items or external delivery.
3. Keep Product, AI, and independent Critic files separate; coordinate on cross-cutting contracts only after each isolated exact-head RC. PR comments are substantive negative-case reviews; this document is a durable cross-lane ledger.
4. Full mandatory source PR gates are not optional (docs-only bypass #520 was rejected by governance). Optimize via source-local adversarial smoke before pushing, workflow reuse, and minimizing branch churn. Historical successful full-source CI elapsed about 2.0–3.1 minutes on R11 #532/#534/#531; this is GitHub runner elapsed, not ChatGPT wall-clock runtime.
5. Accepted vocabulary: SOURCE_IMPLEMENTED / CONTRACT_TESTED / INTEGRATED / REVIEW_DEPLOYED / AUTHENTICATED_UAT_VERIFIED / PROVIDER_VERIFIED. An offline or synthetic fixture is never a signed-in merchant or real provider confirmation.

## Gate

Only integrate R12 when exact PR-head mandatory full source RC, independently reviewed Critic test, and review-source parity pass. After integration, rerun controller exact-head full source plus PG17 recovery, leaving the LIVE Render review untouched unless a separately approved promotion is executed.