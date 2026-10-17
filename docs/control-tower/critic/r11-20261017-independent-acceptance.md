# R11 independent Critic — functional and practical acceptance

Date: 2026-10-17. Repo: SaamVR/ServiceDesk. This is an isolated critic workstream inside the same conversation, not a separate human or background-running autonomous agent.

## Exact-source and live-release boundary

- Canonical V4 source at start: 8ce33b170240923f3a1004da107fd3dc4eaec4f4. [Full RC](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241258), [PG17 recovery](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241298), [source parity](https://github.com/SaamVR/ServiceDesk/actions/runs/38937245521): all SUCCESS.
- **Reconciled release correction:** [Review PR #519](https://github.com/SaamVR/ServiceDesk/pull/519) has merged as `9753888afd4ab015907c33839b62f6ffd8082a24`, with the same tree `ab2fc555b0a59e1beb464c6f7fb88ab266436b33` as tested canonical R10 `8ce33b...`. Isolated Render manual deploy `dep-db9be4m7bikc73fdfemg` is now LIVE at that review SHA and the [exact live SHA plus guest denial gate #38982592703 attempt 2](https://github.com/SaamVR/ServiceDesk/actions/runs/38982592703) PASSED. Newer R11 source remains undeployed; no production main change was made.
- Connected Supabase migration inventory ends at 0062; do not apply 0063 without separate authorization. No signed-in multiowner or real priced merchant/provider UAT was conducted in this run. [Commercial acceptance #487](https://github.com/SaamVR/ServiceDesk/issues/487) remains open.

## Independent lane review

| Lane | Real adverse behavior | Required negative and positive evidence | Assessment |
| --- | --- | --- | --- |
| Product [#531](https://github.com/SaamVR/ServiceDesk/pull/531) | Invalid saved timezone triggers Intl RangeError during staff Today render; unparseable snapshot clock can incorrectly label 0 visits as Schedule is clear | Invalid timezones fail closed; Today's KPI displays unknown, not 0; empty state cannot imply no work; valid UTC, Asia/Dhaka, New York and DST behavior stays correct | Source/regression validation required. Not signed-in browser UAT |
| Core/Finance [#532](https://github.com/SaamVR/ServiceDesk/pull/532) | Invoice projector previously coerced missing ID into phantom string undefined and numbers into valid-looking strings | Reject absent, blank and non-string persisted invoice, workspace and visit IDs; retain valid linked/unlinked invoices and cross-tenant denials | Source/regression validation required. Not Stripe/payment UAT |
| AI/Advisory | Owner numeric-count-only model brief accepts recommendation Review critical attention items tomorrow although facts have no due dates and an existing test deliberately allows it | Future AI change should reject invented relative deadlines, preserve grounded non-temporal review advice, measure rejection/false-positive tests | OPEN Critic finding, no AI code or model invocation in this lane |
| Release QA | Source CI or Git tree parity mistaken for live merchant success | Verify exact head RC and PG17, then actual deployed SHA, authorized two-owner USD price/quote/invoice, internal workflow causality, and controlled provider receipt separately | Merchant operations remains CONFIGURATION_BLOCKED |

## Throughput guidance and veto

- Workstreams remain isolated: Product owns Today and local-day; Core owns invoice persisted projection; Critic owns findings, adversarial acceptance and GitHub documentation.
- Keep the mandatory full canonical PR gate. Earlier docs-only skip PR #520 was rejected and closed unmerged after it failed the mandatory RC contract. Preflight changed code with fast adversarial tests first, but never bypass complete source checks.
- Preserve failed runs and corrections. Report exact tested head SHAs, links, and source-only evidence; do not invent a live browser/provider/payment sign-off.
- Source-green does not mean review-deployed; review-deployed does not mean authenticated merchant UAT or provider-verifed. The previous R10 source integrations #522, #523, #524, #528, #529, #530 and Critic #526 were not a production release.

## R12 follow-up integration evidence

- Product [#531](https://github.com/SaamVR/ServiceDesk/pull/531) is now merged as source correction for missing/invalid persisted staff timezone. Canonical `5a045b04f099eac34f4fb723fb3c3a4bda4fe01c` passed exact [source/Chrome #38983247642](https://github.com/SaamVR/ServiceDesk/actions/runs/38983247642) and [PG17 worker #38983247519](https://github.com/SaamVR/ServiceDesk/actions/runs/38983247519). No real signed-in operator UAT was conducted.
- Core [#532](https://github.com/SaamVR/ServiceDesk/pull/532) was reviewed with exact-head full/critic/parity CI PASS, verified disjoint from intervening canonical paths and merged at `66357cb00bfaace8d1a96e9922fdddd705a8aa42`. Malformed invoice identities now fail closed in the source projection; provider/payment integration remains unverified.
- AI invented-date finding is being addressed in [isolated #538](https://github.com/SaamVR/ServiceDesk/pull/538); current supported evidence is source candidate and regression tests, **not** proof the fix is merged, robust against every natural-language phrasing, or evaluated against a paid model.
- **Quality correction:** a proposed different Core rate-book limit [#536](https://github.com/SaamVR/ServiceDesk/pull/536) was rejected and closed after read-only connected Postgres showed existing `branch_price_books_one_active_idx` unique partial index (workspace_id, branch_id) WHERE active. Its two-effective-book mock could never occur in installed schema. Schema inspection must precede changes claiming to repair invariant breaks.

**Continued blockers:** connected stage has one workspace, zero active services/price books/quotes/invoices/workflow executions/outbox; 0063 not installed; no approved second fictional owner tenant or authenticated browser commercial workflow. Green source and live guest CI must not elevate this to real merchant acceptance.

R11 merge criteria: exact PR-head full source RC, independent Critic and source-parity SUCCESS. Do not present unverified real-world customer operations as complete.