# CRITIC-01 — R26 request lifecycle independent release challenge

**Scope:** \`SaamVR/ServiceDesk\` PR #628, source-based read-only per-request saved data navigation. Reviewed independently in this **separate branch**; do not self-approve product commits.

## Practical efficacy challenge

1. **SAVED vs VERIFIED.** The timeline uses tenant-authorized, bounded saved snapshot rows. It does not establish provider delivery, accepted-quote signature, external automation, settled payment, or successful owner UAT.
2. **Linkage discipline.** Quote selection must ignore superseded records and fail closed when multiple records have the same current highest version. Job links require both request and current quote ID. Invoice links require that exact quote ID. Never attach a historic paid invoice to a newer unaccepted quote.
3. **Bounded snapshot.** No quote/job/invoice in a loaded partial snapshot is NOT equivalent to no record in PostgreSQL. All empty copy must preserve that distinction.
4. **Lifecycle fidelity.** SENT is awaiting customer acceptance; APPROVED is staff status; PAID is only saved ledger status, not independent settlement.
5. **UI accessibility.** Four stages must have link text and an actual href. Blank/multiple states must link to queues, not fabricate saved record URLs.
6. **Operational evidence veto.** The feature is IMPLEMENTED when merged, CONTRACT_TESTED only with exact-head source/DOM/Chrome evidence; do not call it OPERATIONS_VERIFIED without signed-in two-owner staging, independent record readbacks, and a true persisted request→quote→accept→visit→invoice test.
7. **Performance.** This is O(quotes + visits + invoices) per selected request in memory and does not add database calls. Do not multiply the workflow snapshots or store sensitive tenant records in browser analytics.

## Independent tests

\`tests/e2e/v4-r26-lifecycle-critic-adversarial.test.ts\` covers historical invoice false association, superseded highest-version tie, delivery-state distinction and bounded snapshot no-proof behavior.

## Release disposition

Source-only reviewer: **conditional CONTRACT_TESTED** after exact source CI and real browser HTML/DOM checks. **VETO** any claim of live AI inference, customer delivery, business automation, two-owner RLS acceptance or paid settlements based on this feature. The old R13 Render review is not an R26 deployment.
