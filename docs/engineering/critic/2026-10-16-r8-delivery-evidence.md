# CRITIC-01 R8 — Independent review of delivery evidence and operator trust
Observed canonical source at start: `5114b8c0a0848fced9886c8797f60e1478a5ea7c` (2026-10-16). This is a separate **in-chat** critic workstream and GitHub branch, not a claim that another human or autonomous model executed review.

## Fundamental question
Can ServiceDesk genuinely tell the owner whether an outbound customer message was queued, accepted by a provider, delivered, failed, or unverified **without laundering inconsistent metadata into successful delivery**?

## Findings and direct corrective ownership
| Finding | Severity and practical impact | Reproduction from observed source | Correction and proof status |
|---|---|---|---|
| R8A: frontend health labels are inconsistent with saved delivery states | MEDIUM: failed/unknown send can appear as OK if endpoint metadata is contradictory | `parseInboxDeliveryDiagnostics` previously independently validated allowed deliveryState, health, reason, age, and counter totals without validating their relationship. Example: DELIVERED+NEEDS_REVIEW or FAILED+OK passed with matching aggregate counts | [PR #502](https://github.com/SaamVR/ServiceDesk/pull/502). State/health/reason/30-minute-bound consistency and positive/negative Vitest tests. Pending exact-head and combined CI at authoring. |
| R8B: a single provider acceptance event can be counted against multiple messages | HIGH for send evidence: one provider reference cannot confirm multiple separately persisted messages | `readOperationalDeliveryTriage` deduplicated `outbox_event_id` before collecting evidence; two message rows referencing one ID could both inherit `SENT` provider acceptance | [PR #503](https://github.com/SaamVR/ServiceDesk/pull/503). Fail closed on duplicate outbox references **within the authorized window** before loading provider rows; focused fanout-negative and distinct-event-positive tests. Pending exact-head and combined CI at authoring. |

## Acceptance dimensions — never confuse them
- **CODE IMPLEMENTED:** proposed branches changed two disjoint areas: Product `src/features/operations/inbox-delivery-diagnostics.ts` and Server `src/server/integrations/whatsapp/delivery-triage.ts`; tests live in separate existing suites.
- **SOURCE TESTED:** requires successful GitHub Actions full source RC at each exact PR head, then successful combined HEAD RC/PG17/Chrome suite.
- **PRACTICAL BROWSER:** requires an authorized signed-in fictional staff session, a bounded read-only delivery diagnostics request, and an injected/stale contradictory delivery response to verify UI fails closed. Not performed here.
- **PERSISTENCE VERIFIED:** requires owner-authorized real saved message/outbox rows with unique IDs and negative read-back for other tenant. Current connected DB lacks outbound messages/outbox rows, so not performed here.
- **PROVIDER VERIFIED:** requires actual provider acceptance/delivery receipt under controlled operator authorization. A synthetic `SENT` fixture is not such a receipt.
- **RELEASE VERIFIED:** requires Render review `/health.sourceSha` to match the review branch being tested; current observed last LIVE is `5b876a7a...`, review branch `92ebeefabf...`. Release source mismatch remains [issue #483](https://github.com/SaamVR/ServiceDesk/issues/483).

## Independent critic's limits and workstream discipline
1. The R8A parser must allow legitimate `DELIVERED/READ -> OK`, `QUEUED/RUNNING/PROVIDER_ACCEPTED -> PENDING` for age <30, `*_PENDING -> NEEDS_REVIEW(STALE_PENDING)` for age >=30, `FAILED -> NEEDS_REVIEW(PROVIDER_FAILURE)`, `SUPPRESSED -> NEEDS_REVIEW(SUPPRESSED_BY_POLICY)`, `UNKNOWN -> NEEDS_REVIEW(STATUS_MISSING/OUTBOX_RECEIPT_MISSING/OUTBOX_REFERENCE_MISSING)`. No state can become customer-delivered merely because a response claims health OK.
2. The R8B uniqueness rule is for each *branch-authorized* bounded window; an operator in branch A must not read branch B's message or outbox IDs to enforce it. The fix must not send/retry, mutate outbox, or duplicate provider billing.
3. Critic reviews exact diffs and CI, records remaining uncertainties and does **not self-certify independent human evaluation**. One source PASS is never proof of real end-to-end message delivery.
4. Preserved unresolved blockers: QA staging has zero priced services/quotes/outbound receipts; no two authorized owner accounts and no signed-in multi-tenant proof; migration 0063 is not applied. See [#487](https://github.com/SaamVR/ServiceDesk/issues/487), [#153](https://github.com/SaamVR/ServiceDesk/issues/153), [#483](https://github.com/SaamVR/ServiceDesk/issues/483).
5. Faster throughput comes from non-overlapping implementation/test paths, exact-head CI and brief actionable critic receipts — not inflated agent counts or repeated full-suite polling while no manual Render promotion exists.

Verdict at draft creation: **source changes proposed; real owner/provider/deployment acceptance BLOCKED**. Update after recorded exact PR-head and integrated checks; never manufacture a PASS.

## Connected database schema audit (read-only)
The connected `public.messages` table has `messages_outbox_event_fk`: `FOREIGN KEY (workspace_id,outbox_event_id) REFERENCES outbox_events(workspace_id,id) ON DELETE SET NULL (outbox_event_id)`. The `pg_constraint` inventory has no uniqueness constraint on that column; a `pg_indexes` search also found no index covering `outbox_event_id`. Thus the code-level ambiguous-reference test is not demonstrably redundant with an existing uniqueness guarantee. This does not prove duplicates currently exist.

Track the possible structural one-event-per-message invariant independently in [issue #504](https://github.com/SaamVR/ServiceDesk/issues/504), but verify whether any legitimate fanout is modeled before approving DDL. This critic neither changed migrations nor applied connected SQL.
