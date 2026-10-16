# CRITIC R11 — ServiceDesk source, release and merchant-evidence review
Date: 2026-10-17 (Asia/Dhaka). Repository `SaamVR/ServiceDesk`.
This is the CRITIC-01 **role and separate GitHub workstream within this chat**, not an independently activated person or autonomous external agent.

## Grounded release baseline
- Canonical development checkpoint `8ce33b170240923f3a1004da107fd3dc4eaec4f4`: [source/Chrome RC #38937241258](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241258), [PG17 worker #38937241298](https://github.com/SaamVR/ServiceDesk/actions/runs/38937241298), [review parity #38937245521](https://github.com/SaamVR/ServiceDesk/actions/runs/38937245521), all PASS at that SHA.
- [Review-only PR #519](https://github.com/SaamVR/ServiceDesk/pull/519) subsequently merged as `9753888afd4ab015907c33839b62f6ffd8082a24`. Independently checked both canonical and resulting review commit share exact Git tree `ab2fc555b0a59e1beb464c6f7fb88ab266436b33`; review-branch source CI is separate and was in progress when this checkpoint began.
- Isolated Render service `srv-db5p1s142hec739noohg` continues to serve the previously verified R8 source `3bea4f105fb6d7771d38653d1d12d634e80fd687`; it uses `autoDeploy=no`. A push-triggered exact-LIVE gate can fail until a **separate reviewed manual deployment** happens. Never mistake the timing failure for a broken source build or claim that R10 is live.
- Migration 0063 remains **not installed** in connected staging. No Supabase mutation, provider messages, charges or production main changes occurred in this audit.

## Two operational acceptance classes must be separate
| Class | Required actual proof | May depend on controlled external side effects? | Current observation |
| --- | --- | --- | --- |
| INTERNAL_MERCHANT_REHEARSAL | Authenticated owner A pricing save/readback, real request, quote, human acceptance, opted-in internal automation/attention, invoice and negative owner B tenant reads | **No.** Explicitly keep customer sends, charges and paid model calls off | **BLOCKED**: no verified two-owner staging sessions and connected stage has no price book/quote/invoice workflow evidence |
| PROVIDER_PAYMENT_MODEL_VERIFIED | Approved model evaluation, consent-scoped provider send receipt or sandbox payment with immutable persisted ledger linkage | Yes, under separately explicit operator approval | **NOT VERIFIED**, independent of internal merchant rehearsal |

## CRITIC-R11-001 — false internal UAT blocker, fix proposed
- Baseline [merchant preflight #521](https://github.com/SaamVR/ServiceDesk/pull/521) correctly refuses self-issued UAT PASS, but put absence of outbox/outbound rows into `requiredWork`, meaning even a completely safe internal rehearsal with external sends disabled could *never* become ready for independent review without making a customer communication.
- [R11 proposed correction #533](https://github.com/SaamVR/ServiceDesk/pull/533) splits `deferredExternalProof` from internal business prerequisites. The internal readiness flag may reach `READY_FOR_INDEPENDENT_ACCEPTANCE_REVIEW` while outbound message/outbox counts remain zero. Positive event counts also cannot produce `PROVIDER_VERIFIED`; provider, payment and model proof remain deferred and separately controlled.
- **Limitations:** This is an offline script accepting operator-supplied aggregate evidence. Its `fictionalOwnerSessions=2`, `externalEffectsDisabled=true`, provenance field and reported LIVE SHA are **not independently authenticated or queried by this script**. `acceptanceVerified` remains false in every valid result. Even when code CI passes, label it `CONTRACT_TESTED`, not `OPERATIONS_VERIFIED`.

## CRITIC-R11-002 — unresolved merchant environment prerequisites
Existing [merchant acceptance #487](https://github.com/SaamVR/ServiceDesk/issues/487) is the owner. Latest connected aggregate evidence from R10: one ACTIVE owner membership, one active USD branch, zero active services, zero active price books, zero saved quotes/workflow executions/invoices and zero outbound provider events. The source/UI onboarding fixes do not insert business prices. No duplicate issue or accidental synthetic production account should be created. **Authorized owner must configure real fictional-branch prices via actual signed-in UI, then record persisted read-back and tenant A/B negative evidence.**

## CRITIC-R11-003 — AI outreach guard still language-bounded
The merged generic `src/server/ai/request-brief-safety.ts` blocks multiple direct and delegated outreach phrases; this is safer than earlier rules. The older draft [AI #516](https://github.com/SaamVR/ServiceDesk/pull/516) remains unmerged and had a previous safety-layer integration block. Do not force merge it or claim comprehensive language containment. Prefer a small explicit set of allowed owner review actions / validated structured outputs over a promise that an open-ended regex can recognize every indirect instruction. Negative model eval on authorized fictional data and human usability testing remain outstanding.

## Multilane and throughput policy
- **Product**: owner first-run activation and authenticated browser UAT.
- **Core**: quote, transaction, ledger, tenant RLS, SQL migration compatibility and no fabricated success.
- **Connector/AI**: approved external provider/model trials and grounded suggestions.
- **Release controller**: pins a tested source SHA, reconciles review branch, manually promotes isolated Render and validates LIVE exact SHA + guest route.
- **CRITIC-01**: distinct findings/branch, source-overlap review, veto on unsupported release claims and measured workflow improvements. These are ownership roles, not proof that five autonomous workers exist.
- PR count, response duration and CI minutes are not substitutes for **accepted merchant tasks**. Share code/test receipts and differentiate SOURCE/PERSISTENCE/BROWSER/PROVIDER/OPERATIONS evidence.
- Avoid expensive repeated CI runners on documentation-only PRs when a tested diff-based required-check equivalent can retain exact confidence; see [#518](https://github.com/SaamVR/ServiceDesk/issues/518). No required gate was bypassed here.

## Decision
- Source release candidate: R10 canonical and review TREE-ID VERIFIED.
- Connected live Render: R8 exact-SHA VERIFIED; R10 post-promotion verification PENDING.
- Offline UAT-gating correction: source candidate #533, **pending full exact-head checks**.
- INTERNAL MERCHANT OPERATIONS: **CONFIGURATION_BLOCKED**.
- EXTERNAL PROVIDER / PAYMENT / MODEL: **NOT VERIFIED**.
