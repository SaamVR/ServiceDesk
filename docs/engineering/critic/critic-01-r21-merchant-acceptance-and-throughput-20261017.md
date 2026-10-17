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


## Critic-01 observed RED and correction — mandatory honesty

**Exact old candidate `86d1eb8dd5746c749e5af699cb8a322a7d8af834`**: [full source PR #39027441119](https://github.com/SaamVR/ServiceDesk/actions/runs/39027441119) **FAIL** with **3,047/3,048 passing**, in the new `v4-r21-committed-dispatch-entry-identity.test.ts`. The "WEBHOOK with no registered dispatcher" test expected `UNSUPPORTED_DISPATCH_CHANNEL` but observed `OUTBOX_COMMIT_CLAIM_INVALID` instead. The test fixed `committedAt=2026-10-17T12:00:01Z` while GitHub's actual clock was 2026-10-17T11:08Z; preexisting chronology safety rejected it *before* checking the dispatch table.

**High-severity critic observation:** The other negative ID tests could have passed for the **same wrong reason** (future claim), so the earlier purported zero-provider-call adversarial coverage had not actually exercised the intended tenant/idempotency guard. This is a test quality defect, not a reason to bypass or loosen claim chronology. The lane corrected the two fixture times to 2026-10-04T12:00:00/01Z, an authentic past ordered claim, without modifying any runtime source or deleting assertions. Lane correction commit `c7d5272b2f816324b3f3ccb9ba6d96724337ae69`; revised combined PR candidate `afc29f505a6e87a7a2f0fd22018eebeced012ba3`. **This replacement still requires its own exact-head executable RC; prior green quote, critic and parity workflows do NOT certify this revised candidate.**

**CI efficiency verdict:** The first failing full run exposed a meaningful regression-fixture defect and warranted one corrected re-run, not repeated blind retries. The critic-doc PR's scoped [#39027444634](https://github.com/SaamVR/ServiceDesk/actions/runs/39027444634) used the classifier **fast path**: dependency installation, full tests and Next build were **SKIPPED**; the required job concluded SUCCESS. Do not describe this lightweight receipt as full source validation. Billing-minutes savings were **not measured**.

**Critic HOLD continues** until the revised candidate's exact-head full RC succeeds, integration ancestry is verified and no parallel canonical changes are overwritten. Even source PASS will not establish real two-owner merchant UAT, provider delivery, 0063 migration or live deployment readiness.


## Critic-01 final R21 SOURCE verdict (post-fix exact SHA)

**Revised executable PR #617 source** `afc29f505a6e87a7a2f0fd22018eebeced012ba3`: [full-source #39027684054](https://github.com/SaamVR/ServiceDesk/actions/runs/39027684054) **PASS**, **606/606 files, 3,048/3,048 tests**, TypeScript and Next production build PASS, ESLint **0 errors / 31 warnings**. [Review merge-parity #39027684220](https://github.com/SaamVR/ServiceDesk/actions/runs/39027684220) PASS, [Critic #39027684103](https://github.com/SaamVR/ServiceDesk/actions/runs/39027684103) PASS, [internal quote automation #39027684052](https://github.com/SaamVR/ServiceDesk/actions/runs/39027684052) PASS. Source diff against `da9a996acb8abc13c77884104a1cca771a344ee6` is exactly **2 forward commits, 0 behind, 6 exclusive paths**, with no SQL or workflow alterations.

**Independent verdict now:** `CONTRACT_TESTED` **for source only**. Corrected tests actually exercise dispatch identity rather than being short-circuited by the future-claim gate. The prior RED remains part of the evidence ledger; it is not erased by the later PASS. **Canonical development integration may be considered** if live canonical still equals the pinned parent and the coordinator keeps a new exact-head canonical full/Chrome and PG17 checkpoint. The PR remains draft as a reviewed WIP artifact.

**Merchant/release verdict remains HOLD / CONFIGURATION_BLOCKED**: no signed-in two-owner fictional workspace proof, priced service/book/quote/invoice chain, provider receipt, approved 0063 or owner-reviewed Render promotion. A green source test can never substitute for those external facts. The docs-only Critic workflow's required job remains lightweight; it is not a second full source receipt.
