# CRITIC-01 — R20 independent functional, merchant-efficacy and throughput review

**Review date:** 2026-10-17. **Reviewer lane:** CRITIC-01, logically separate from coding lanes **inside this chat**, not a second autonomous agent. **Review base:** `a758a87827b7be02e363d0e61eee1f8c9eb0014e`. This is an adversarial *source and workflow review*, not a claim of executed R20 Vitest or real-merchant acceptance. Keep this document on a documentation-only branch.

## Baseline receipts and limits

- Latest observed canonical: `a758a87827b7be02e363d0e61eee1f8c9eb0014e`, [exact-head full source and synthetic Chrome RC #39018499101](https://github.com/SaamVR/ServiceDesk/actions/runs/39018499101) **PASS**; [PG17 #39018499110](https://github.com/SaamVR/ServiceDesk/actions/runs/39018499110) **PASS**. These results apply ONLY to canonical `a758a87827b7be02e363d0e61eee1f8c9eb0014e`, not to the R20 lane heads below.
- Isolated Render review [service srv-db5p1s142hec739noohg](https://dashboard.render.com/web/srv-db5p1s142hec739noohg) remains LIVE at `3962aa5c84c3aa5f47ad72b62d51ae4382467708`, R13; auto deploy OFF. Do not promote from R20 source without a manually approved pinned release gate.
- Connected database `cpmmgivhlkfbiwzhlcey` is healthy. A read-only aggregate check observed 1 membership, 1 branch, 1 request and **0** active services, rate cards, price books, quotes, invoices or outbox events. Installed migrations end at **0062**; 0063 remains uninstalled/default-OFF.
- Three remote-device connections are **NOT a development mechanism**. A read-only device listing showed samvr/samai online and DESKTOP-8L5A17Q temporarily offline. None was used for code, tests or UAT.

## Independent adversarial findings and vetoes

| Lane | Pinned PR / latest lane source | Critic's test of usefulness and failure mode | Verdict before executable evidence |
|---|---|---|---|
| **R20A Core/Finance** | [#607](https://github.com/SaamVR/ServiceDesk/pull/607) at `93fd9c564ec2b8e26679f761962cc2d6b53d5bee` | Duplicate FormData pricing/branch/owner IDs could let `form.get` silently select the first of two contradictory prices. New parser rejects duplicates for all mandatory priced fields and invisible directional service names; must verify normal single-copy form and readback still pass | **REVIEW / CONTRACT UNVERIFIED** |
| **R20B Connectors** | [#608](https://github.com/SaamVR/ServiceDesk/pull/608) at `791f29a3025f44f27c2f2b89a88cd721a08c10d6` | `Date.parse` can normalize impossible dates or assume local timezone. New validation rejects malformed civil dates and missing zones; verify Unix seconds, milliseconds and offset boundaries. **Timestamp parsing is not provider delivery verification** | **REVIEW / CONTRACT UNVERIFIED** |
| **R20C Product/UI** | [#609](https://github.com/SaamVR/ServiceDesk/pull/609) at `de1a0419e6fb1d038b28c23812a478c64ba9621e` | A coerced ledger value object could execute `valueOf` before validation. Guard checks integer types before arithmetic and currency primitives before regex. Verify already-paid, refunds, tenant-owned authorization, and no checkout/session created for corrupt amounts | **REVIEW / CONTRACT UNVERIFIED** |
| **R20D Calendar** | [#610](https://github.com/SaamVR/ServiceDesk/pull/610) at `912f7630e8fad671cfd1f2a4eac0109feb47011b` | **Critic initially VETOED** claim-only checks: a recovered projection could contain mismatched VisitDTO or forged mapping ID while top-level labels agree. Corrective follow-up now checks embedded visit, exact idempotency, crew, request, quote and mapping identity, and rejects object-coerced IDs. Needs dispatcher negative adapter-call proof; no Google Calendar provider receipts | **REVIEW / CRITIC FIX AUTHORED, NOT YET TESTED** |

**Prohibited false claims:** Draft PR existence, GitHub commits, good syntax appearance, a mocked provider adapter, disposable PG17, HTTP guest health, isolated Render R13, or one signed-in owner do not establish real two-owner merchant quote→accept→internal attention→invoice persistence, production release readiness, or provider delivery.

## Critic-01 release/acceptance veto

1. **R20 developer acceptance:** compile and pass each negative fixture at the *exact PR SHA*, including existing behavior tests. Then compare all four PRs against a single fresh canonical base; reject overlapping writes or stale source. Preserve original PR heads and integrate once per safe batch. Full exact-head `pnpm check:rc` + Chrome belongs on the **integrated candidate**, not four duplicate full builds. Do not trigger PG17 for unrelated FormData/WhatsApp/Calendar/UI changes; retain its prior verified SHA as historical evidence only.
2. **Merchant efficacy:** missing second authorized owner and active catalog/pricing/quote/invoice/outbox records is a hard **CONFIGURATION_BLOCKED** gate. An authorized test must prove owner A's real saved cleaning service/rate/price book, branch-scoped request, quote, acceptance, internal attention/outbox and persisted invoice, with strict owner B negative access. Verify duplicate retries do not create duplicate invoices or messages; no external provider send or payment. Capture redacted receipt IDs, timestamps, DB transaction/readback and user-observed workflow. No fixtures mistaken for live tenant rows.
3. **Migration and live deployment:** 0063 is uninstalled: do **not** apply to connected database without explicit approval. Test default-OFF behavior in disposable PG17 only. Render R13 remains live and isolated; require explicit manual review of pinned new SHA plus exact guest/health and signed-in negative evidence before promotion.
4. **Security and authorization:** maintain #153 and merchant blocker #487. No real messages, payments, model opt-in changes, credentials, production/main merge or device development.

## Measurable throughput protocol

- Schedule *four disjoint executable slices* plus one **independent** Critic-01 lane. Each owns its exact source and test paths. Review only one completed batch per owner at once; do not spawn unreviewed overlapping WIP.
- For each slice record: source base/head SHA, changed paths, focused command, actual exit code/log link, owner-visible behavior, negative scenarios, minutes measured (or **NOT MEASURED**), number of CI runs/cancellations, release evidence level.
- Critic gate can **veto** if tests are absent, tests don't assert a practical failure, or user/customer-facing effects are asserted from mocks. Log a corrective source commit on the developer branch; keep critic review separate.
- Avoid 4 full RC + PG17 copies when one integrated exact SHA suffices. Critic docs-only PR uses [lightweight acceptance workflow](https://github.com/SaamVR/ServiceDesk/blob/a758a87827b7be02e363d0e61eee1f8c9eb0014e/.github/workflows/v4-critic-acceptance.yml) and must not trigger heavyweight build. No invented runtime duration or repeated idle coordination.

**Critic decision now:** all R20 lanes remain **IMPLEMENTED, not yet CONTRACT_TESTED**; no acceptance/promotion. Release **CONFIGURATION_BLOCKED**. This review does not claim it has independently executed a browser or queried customer-identifying data.

## Critic follow-up — actual R20 combined test receipts

- Newer canonical development moved **forward-only** beyond pinned authoring base, first to `013959c5b657dc5ce576201d2fab9665bd9eba17`, then `25bdf65dac8c5d0f11dfc9ddfdb6212a5e82f168`. R20A/B/C/D source and test paths did not overlap the first intervening source changes, as checked before a scoped candidate was created. Never reset or overwrite these newer changes.
- Isolated scoped candidate `e61236464ee649fcaa47669517063696b14507a2` at base `013959c5...`, [focused run #39019773513](https://github.com/SaamVR/ServiceDesk/actions/runs/39019773513): **8 test files / 35 tests PASS**, **full TypeScript typecheck FAIL** at `tests/providers/v4-r20d-calendar-claim-integrity.test.ts:35` (TS2352 invalid direct cast for malformed event payload). Thus the candidate was **NOT ACCEPTED** despite green tests.
- Critic requested a source test-only repair on R20D lane `21c1ae6ba19372fbea281667cf9a9aa58554359e` and the candidate `70611c469f71c9f91d4bdbd9d3f8bb2a20d89a9d`. The corrected malformed payload uses `as unknown as ClaimedOutboxEvent`, preserving the runtime negative assertion. [New focused check #39019913008](https://github.com/SaamVR/ServiceDesk/actions/runs/39019913008) requires inspection at exact SHA before acceptance.
- Full R20 source RC and dedicated PG17 are *not* needlessly duplicated on each source PR. Production-like R13 Render remains isolated. The newer canonical PG17 source run [#39019797940](https://github.com/SaamVR/ServiceDesk/actions/runs/39019797940) was successful at `25bdf65...` during this review; full source RC requires independent inspection.

**Critic verdict remains HOLD / REVIEW until** the exact `70611c...` candidate passes focused and TypeScript checks, its clean integration is reconciled with the **newest** canonical HEAD, and exact canonical full RC + PG17 have genuinely run. A green 35-test subtotal does not erase a failed TypeScript gate.
