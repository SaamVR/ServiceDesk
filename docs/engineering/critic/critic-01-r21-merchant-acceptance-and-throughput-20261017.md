# CRITIC-01 R21 — independent acceptance, product-usefulness and engineering-efficiency verdict

**Reviewer:** Critic-01, a separate logical review lane within the same development chat. **NOT** another independently executing agent or human. **Pinned source parent:** `da9a996acb8abc13c77884104a1cca771a344ee6` (canonical branch `feat/servicedesk-v4-reconciled-qa-shell-20261012`). The source currently has exact-head full RC [#39020606450](https://github.com/SaamVR/ServiceDesk/actions/runs/39020606450) **PASS** and PG17 [#39020606469](https://github.com/SaamVR/ServiceDesk/actions/runs/39020606469) **PASS**. Neither passes the new R21 changes automatically.

## Critic's independent merchant-impact findings (not developer self-certification)

1. **P0 operational false-ready clock — Product lane.** The prior staff quote checklist tested the shape of a zoned timestamp and delegated to permissive `Date.parse`, whereas the customer quote acceptance path checks real civil dates and six fractional digits. A quote with `2026-02-30`, `2026-04-31`, or an invalid offset could appear human-ready despite never being safely customer-acceptable. The Product lane reuses `trustedQuoteInstant`, and tests impossible dates, offsets, exact deadline, legitimate leap-day and microsecond receipts. This reduces false staff confidence, not actual sending authorization.

2. **P0 direct-entry provider boundary — Connectors lane.** The upstream outbox resolver already validates string IDs; the committed dispatch router accepted whitespace or control-character-laden job/tenant/idempotency IDs, and unsupported strings including `__proto__` as an adapter-table key. A recovery or alternate worker may call the router directly. Proposed invariant: no external adapter invocation until all identity, channel/purpose, handover and dispatcher-table shapes are exact. Adversarial test uses a throwing spy and asserts **zero** adapter calls, and preserves legitimate no-dispatcher terminal-failure behavior.

3. **P1 legacy accepted-after-expiry guard — Core lane.** Repository quote acceptance checked `new Date(now) > new Date(validUntil)`. A NaN comparison is false and an equality boundary also passes, allowing ACCEPTED mutation when a quote has no provable future expiry. The Core lane rejects corrupt or unzoned dates and equality without any `updateQuoteStatus` invocation. **Scope limitation:** this is the legacy repository seam and **not** evidence that a live PG17-backed quote command has been customer-accepted. Legacy fixture examples use synthetic rate cards; never promote them into operational rates.

## Testability and integration contract

| Lane | Exclusive source | New test | Initial result |
| --- | --- | --- | --- |
| Product | `src/features/operations/staff-quote-checklist.ts` | `tests/e2e/v4-r21-staff-quote-real-calendar-acceptance.test.ts` | Source authored; GitHub full RC pending |
| Connectors | `src/server/integrations/outbox/dispatch-router.ts` | `tests/providers/v4-r21-committed-dispatch-entry-identity.test.ts` | Source authored; GitHub full RC pending |
| Core | `src/server/core/quotes.ts` | `tests/db/v4-r21-legacy-quote-accept-zoned-clock.test.ts` | Source authored; GitHub full RC pending |

All six paths must be pairwise disjoint relative to the same exact parent; a PR must be **DRAFT** until its own exact-head CI and independent critic review. Focused command:
`pnpm exec vitest run tests/e2e/v4-r21-staff-quote-real-calendar-acceptance.test.ts tests/providers/v4-r21-committed-dispatch-entry-identity.test.ts tests/db/v4-r21-legacy-quote-accept-zoned-clock.test.ts`.
Then **one** executable integration full `pnpm check:rc` and, per V4 gate, **one** PG17 workflow if exact-head parity is required. Do not trigger a full source run on this docs-only Critic branch or repeatedly restart full RC on intermediate code SHAs. Record actual run IDs, conclusions and failures before declaring `CONTRACT_TESTED`.

### Independent veto and remaining risks

- **Critic result at authorship: HOLD / code review ONLY.** Logical behavior and new negative tests exist, but no R21 exact-head executable evidence is yet available. Do **not** copy earlier green canonical receipts to the candidate.
- The Core and Product clock parsers are separate; a future shared-clock consolidation may reduce drift, but a blind cross-layer import introduces dependency risks and is **not** part of this batch.
- A rejected frontend readiness or adapter command is not proof of persisted database ownership checks; PG17 and two authenticated fictional owner sessions remain separate.
- Connected ServiceDesk Supabase is healthy on Postgres 17, applied migrations through **0062**, with **1 workspace, 1 membership, 1 branch, 0 active service rows, 0 branch price-books, 0 saved quotes, 0 invoices, 0 outbox rows** at inspection. Two-owner quote → accept → internal attention → invoice **OPERATIONS_VERIFIED** acceptance cannot be claimed. Explicit owner authorization for a safe fictitious merchant environment, cleanup and second identity is still required [#487](https://github.com/SaamVR/ServiceDesk/issues/487).
- 0063 must remain **uninstalled/default-OFF**; AI opt-in must remain OFF; no real provider sends, customer messages, live payments, unsolicited deployment, or protected main merge. [Security #153](https://github.com/SaamVR/ServiceDesk/issues/153) and merchant #487 remain blockers.
- Last reported live isolated Render service was R13. This chat has no owner-confirmed Render workspace selection, so it cannot independently certify its live SHA or promote a newer candidate. Do not replace it with a synthetic browser PASS claim.

## Throughput critique and accountable engineering

The latest canonical had **96 more commits than the historical R14 baseline** and both most recent RC/PG17 gates PASS, so reimplementing R14 features would waste time. This batch deliberately addresses three disjoint concrete edge cases on one pinned base, collects source-diff ownership receipts, and schedules **one** combined executable PR gate rather than three duplicate full RC/PG17 sequences. No duration or Actions billable minutes were measured; do not invent throughput improvements or claims about extending the platform runtime. If any exact-head focused test is red, quarantine its lane, fix source/fixture without dropping assertions, and rerun the smallest relevant checks before reconciling the integration.

**Classification:** 3 isolated source lanes `IMPLEMENTED` only; `CONTRACT_TESTED` pending exact-source proof. `OPERATIONS_VERIFIED` and `PROVIDER_VERIFIED`: **NO**. **Final release stance: HOLD**, independent of later source PASS.
