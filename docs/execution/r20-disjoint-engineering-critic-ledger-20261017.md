# R20 controller — disjoint ownership and source-first efficiency receipt

**Pinned source base:** `a758a87827b7be02e363d0e61eee1f8c9eb0014e`, full source+Chrome RC and PG17 PASS. New lane commits are unverified until their own executable tests run.

| Lane | Branch | Last authoring SHA | Exclusive source + dedicated test |
|---|---|---|---|
| R20A Core | `feat/sd-v4-r20a-core-pricing-input-20261017` | `93fd9c564ec2b8e26679f761962cc2d6b53d5bee` | `src/server/core/owner-cleaning-pricing-input.ts`; `tests/db/v4-r20a-pricing-form-ambiguity.test.ts` |
| R20B Connectors | `feat/sd-v4-r20b-whatsapp-time-evidence-20261017` | `791f29a3025f44f27c2f2b89a88cd721a08c10d6` | `src/server/integrations/whatsapp/timestamp-normalization.ts`; `tests/providers/v4-r20b-whatsapp-chronology.test.ts` |
| R20C Product | `feat/sd-v4-r20c-product-invoice-preflight-20261017` | `de1a0419e6fb1d038b28c23812a478c64ba9621e` | `src/features/operations/customer-invoice-checkout-readiness.ts`; `tests/e2e/v4-r20c-invoice-preflight-input.test.ts` |
| R20D Calendar | `feat/sd-v4-r20d-calendar-claim-integrity-20261017` | `912f7630e8fad671cfd1f2a4eac0109feb47011b` | `src/server/integrations/outbox/calendar-visit-intent.ts`; `tests/providers/v4-r20d-calendar-claim-integrity.test.ts` |
| CRITIC-01 | `docs/sd-v4-r20-critic-01-20261017` | this docs commit | `docs/engineering/critic/critic-01-r20-merchant-runtime-and-throughput-20261017.md`; this controller receipt |

**Exit criteria:** exact diff/SHA reconcile, negative focused Vitest and typecheck, independent critic review, one full exact-head RC on integrated executable source, PG17 only if source-relevant, preserve R13 Render. No device, real payment, customer/provider messages, Supabase mutations, staging 0063 or protected main merge.

**This turn's test execution:** no dedicated GPT Runtime checkout or package/test executor is available from the connected GitHub adapter. Therefore all four code PRs are **source-only WIP / tests authored, not run**. Do not infer a PASS from a commit or the historical canonical full RC.
