# F24 — Fence legacy split-phase visit scheduling (2026-11-06)

**Feature Chat, SOURCE ONLY.** Existing [IR21 #915](https://github.com/SaamVR/ServiceDesk/pull/915); no new PR, Supabase changes or deployment. Based on checked parent `89d3edc5e190f6fb3fdb900a54a2a60863dc990a`.

## Demonstrated defect and correct production boundary

The old `scheduleVisitFromHoldWithRepository` independently called `confirmHold` **before** `insertVisit`. A second-call failure could persist `CONFIRMED` while no visit exists. The legacy `VisitTableGateway` also exposed the two writes separately. That is unsafe as a booking path.

The production deposit path already has a better source mechanism: `supabase/migrations/0010_e03_verified_payment_rpc.sql` creates a visit, links invoice/payment evidence, and confirms the hold in one PL/pgSQL invocation when an independently VERIFIED DEPOSIT event is applied. Do **not** create a second booking/payment RPC or treat a slot hold as a paid scheduled visit.

## Changes and disjoint lanes

- **Backend:** `src/server/core/visits.ts` now requires `verifiedPaymentApplicationId` and a `commitScheduledVisit` atomic repository capability. It does not call split-phase methods. It rejects mismatched hold/slot/workspace and requires a confirmed-hold **and** matching scheduled-visit receipt.
- **Adapter:** `src/server/core/visit-repository.ts` retains deprecated two-write *gateway types* for compatibility but NEVER invokes those operations from its scheduling adapter. If no trusted transaction-backed `commitScheduledVisit` exists, it returns `ATOMIC_VISIT_UNAVAILABLE`. A transaction result is mapped and checked against exact workspace, request, quote, slot, hold, crew, times and status.
- **QA:** Existing `tests/db/visits.test.ts` and `tests/db/visit-repository-adapter.test.ts` now require an atomic mock gateway, verify deposit references and fail-closed rejection without an atomic gateway or on forged post-write receipts.
- **Independent Critic:** `tests/db/f24-atomic-visit-critic.test.ts` forbids legacy split calls, confirms the existing verified-deposit SQL atomic source, and rejects a false temporary-hold booking claim.
- **CI:** Reuse ONE IR21 exact-head source workflow for the changed-focused test, lint, typecheck and Next build. Existing PG17 F15 jobs remain reusable SHA evidence; they do **not** prove a deployed booking transaction.

## Honest limits and release gate

This is a **security-critical source repair** and **atomic-port contract**, not a live manual booking feature. No concrete database gateway was authorized/deployed that independently verifies a payment application and commits visits from this legacy service. The source therefore rejects unsafe manual scheduling unless a future explicitly reviewed atomic gateway is provided.

To operationally verify a customer booking, Production Chat must separately authorize P02 distinct owner A/B UAT, P03 genuine price book, trusted verified deposit processing, and a booked visit **persisted** in the same tenant with a matching CONFIRMED hold, invoice, verified APPLIED payment and available crew slot. That must use the existing payment RPC and browser/JWT/tenant denials, not mock-only tests.

**Concurrency caution:** A receipt from an untrusted gateway is not proof of transactionality; independent human DBA review and PostgreSQL adversarial rollback/duplicate tests are still required before activating any new atomic gateway. Do not re-label the API contract as installed code. No authorizations were implied by 'Continue'.

**NEXT TASK:** Production Integrator verifies this exact #915 successor and installed payment/visit RPC receipt gate, then obtains explicit P02 authorization for real two-owner staging. Feature Chat should add an **owner read-only saved booking receipt** anchored to actual verified deposit and scheduled visit rows, without any new payment/send command, if there remains a genuine staff UI gap.
