# R11 independent Critic — functional and practical acceptance

Date: 2026-10-17. Repo: SaamVR/ServiceDesk. This is an isolated critic workstream inside the same conversation, not a separate human or background-running autonomous agent.

## Exact-source and live-release boundary

- Canonical V4 source at start: 8ce33b170240923f3a1004da107fd3dc4eaec4f4. [Full RC](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241258), [PG17 recovery](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241298), [source parity](https://github.com/SaamVR/ServiceDesk/actions/runs/38937245521): all SUCCESS.
- The isolated Render review is LIVE on older R8 commit 3bea4f105fb6d7771d38653d1d12d634e80fd687. Review PR #519 remains draft. No R11 review promotion or production main change was performed.
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

R11 merge criteria: exact PR-head full source RC, independent Critic and source-parity SUCCESS. Do not present unverified real-world customer operations as complete.