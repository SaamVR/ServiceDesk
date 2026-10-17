# R13 independent Critic lane — saved work proof, price integrity and practical acceptance

2026-10-17 Asia/Dhaka · Canonical ServiceDesk V4 controller · Review branch baseline `25e32bcfede3fc7f662e4459675934fd2a7b189d`.

> This is an independently scoped **Critic lane inside the same engineering conversation**, not a separate human, model instance, autonomous background service, or successful authenticated business UAT.

## Release and evidence baseline

- At R13 kickoff exact canonical commit `25e32bc...` passed the [exact-head full source RC](https://github.com/SaamVR/ServiceDesk/actions/runs/38986833302) and [PG17/worker suite](https://github.com/SaamVR/ServiceDesk/actions/runs/38986833343). Source regression success is not a live customer journey.
- Isolated Render review was LIVE on `5f1c36f067e222eb1ecf66b368bb0d34e6a099aa` when inspected. It is not this R13 source; no R13 deployment performed. Production main remains `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`.
- Connected Supabase migrations installed through `sd_0062`, with **0063 OFF**. Read-only stage still contains 1 workspace, 0 active services, 0 branch price books, 1 request, 0 quotes, 0 invoices, 0 workflow executions. Merchant acceptance #487 remains a commercial release blocker.

## Separately scoped functional critique

| Lane | Actual read-model defect | New bounded implementation | Adversarial acceptance checks | Open limitations |
| --- | --- | --- | --- | --- |
| **Core saved visit proof [PR #549](https://github.com/SaamVR/ServiceDesk/pull/549)** | `String(undefined)` on visit/actor IDs and dates; `Boolean("false")===true`, `Boolean(undefined)===false` on saved checklist; `Number(undefined??0)===0` on persisted version. A malformed saved payload could appear as real completed or incomplete work. | Require persisted nonblank identity/actor, zoned valid timestamps, literal boolean, safe nonnegative integer version; keep existing tenant scope checks. | Both `completed:true` and `false` positives; missing/number/string/null booleans, invalid dates, fabricated IDs and versions negative; cross-tenant negative. | No signed-in field staff proof, no real photo persistence test, no migration. `mediaReference` remains not specially validated and warrants future coverage with actual contract. |
| **Product staff quote proof [PR #550](https://github.com/SaamVR/ServiceDesk/pull/550)** | `numberValue()` defaults missing/invalid saved quote subtotal/tax/total/deposit/balance/duration to zero while an APPROVED or SENT quote can appear ready for human delivery. | Fail a staff read gracefully before quote projection if mandatory money/identity/status/version has invalid source evidence; retain valid zero-value drafts and existing verified line-item checks. | Undefined/null/string/fractional/negative/unsafe values for each monetary field, false identity and malformed currency/version, all-negative fixture; positive `DRAFT`, `PENDING_APPROVAL`, APPROVED and SENT. | One corrupt row blocks entire staff quote workspace. No real merchant persisted quoted data in stage; the default-on failure surface is intentional but needs UX review. |

## Direct read-only installed database reconciliation

- `public.quotes` requires NOT NULL integer `subtotal_minor`, `tax_minor`, `total_minor`, `deposit_minor`, `balance_minor`, `duration_minutes`, `buffer_minutes`; `version` bigint and nonnullable; currency `character(3)`, quote/request UUIDs. Its `quote_status` enum includes **`PENDING_APPROVAL`** in addition to DRAFT/APPROVED/SENT/ACCEPTED/DECLINED/EXPIRED/SUPERSEDED. The Critic caught an initial Product whitelist omission **before release**, and the validator/test were corrected. This check validates schema assumptions rather than inventing fixture facts.
- `public.visit_checklist_items.completed` is `boolean NOT NULL`, `version` `bigint NOT NULL`, updated actor and clock nonnull. `public.visit_evidence` requires actor ID, visit ID, captured_at and created_at nonnull; rejecting the RPC coercions is consistent with installed columns.
- Database column constraints alone do **not** prove the application RPC payload is shape-safe; source guards verify readback. No SQL changes were performed.

## Independent engineering efficiency review

1. Keep Core and Product files/test suites on disjoint branches to avoid source file collisions, merge only after the exact PR-head RC, independent Critic and review parity; do not merge from a test on a previous commit.
2. Schema-driven positive examples are essential. The R13 Product source guard was updated when live enum inspection revealed `PENDING_APPROVAL`, preventing a normal approval state being blocked by a safety patch. Negative cases are necessary but insufficient.
3. Do not claim true merchant usability from green unit/PG17 tests. Staging still lacks a second tenant, pricing, saved quote and invoice, provider callbacks and reviewed operations. Owner activation needs consented/approved test owners, with separate payment/provider send authority.
4. Keep CI governance transparent: [issue #545](https://github.com/SaamVR/ServiceDesk/issues/545) records that PR #542 changed docs-only PR handling to a required-green job that can skip `pnpm check:rc`. Documentation-only CI success is **not** the same as executing the full source suite. Canonical post-merge source runs continue to provide full build proof.
5. Optimize effort by batching relevant source tests and checking historical snapshots and actual DB enum/column contracts **before pushing**. Use GitHub runner checks for source and PG17 and reserve remote devices for flows impossible in CI; no paid model calls or external provider triggers from this review.

## Acceptance boundaries

Use labels accurately: SOURCE_IMPLEMENTED ≠ CONTRACT_TESTED ≠ CONTROLLER_INTEGRATED ≠ REVIEW_DEPLOYED ≠ AUTHENTICATED_MERCHANT_UAT ≠ PROVIDER_VERIFIED. No R13 source promotion, customer data mutation, automatic outreach, manual payments, migration or production merge is authorized here.