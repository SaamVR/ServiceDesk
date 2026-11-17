# SONIC F26 — Verified booked-visit dispatch, explicit owner action

**Repository:** SaamVR/ServiceDesk. **PR:** existing open draft #915. **Status:** source only; rollout flag off. No connected database, deployment, payment or provider write.

## Business journey
Owner opens Quotes and selects the **actual ACCEPTED saved quote** with **one verified APPLIED deposit, CONFIRMED hold, scheduled visit and matching invoice**, as proven by existing F25. If the visit is still `SCHEDULED`, and a separately approved server-side `SERVICEDESK_F26_OWNER_DISPATCH_ENABLED=true` exists, the owner can explicitly click **Assign this verified booked visit**.

The server revalidates the saved booking and authenticated OWNER/ALL scope, compares same owner identity, calls existing version-aware `transitionOperationalVisit(...,"ASSIGN")`, and then revalidates the exact quote, visit, invoice, price revision and applied deposit again. Only an independently saved `ASSIGNED` visit is reported as verified. Failed or ambiguous writes never auto-retry.

**Important:** existing visit transition queues an internal `calendar.visit.upsert` outbox event. That is NOT proof of calendar/provider delivery and its later worker activation requires separate production permission. The action never creates a visit, changes a payment, sends messages or creates an automatic recurring workflow.

## Parallel code ownership
- Backend: `src/server/workflows/owner-verified-booking-dispatch.ts`
- Server action + owner UI: `src/features/operations/owner-verified-dispatch-action.ts`, `OwnerVerifiedBookingDispatchControls.tsx`; additive import in existing `OwnerSavedBookingReceiptPanel.tsx`
- QA/independent Critic: `tests/ai/f26-owner-verified-booking-dispatch.test.ts`, `tests/ai/f26-owner-verified-booking-dispatch-critic.test.ts`
- Integrator: same IR21 focused CI (TS, lint, Next build) and source blob manifest `docs/delivery/sonic-f26-verified-booking-dispatch-source-lock-20261106.json`. Prior F15–F25 immutable source untouched.

## Release-critical dependencies
P02 #818 real distinct signed-in owner A/B tenant isolation and approved Vercel/staging environment; P03 #819 authentic services/branch rates; installed payment/booking RPC verified with real saved records. Do not activate a calendar outbox worker or deploy/change production without owner approval. The feature is not production-ready because source CI alone cannot prove a paid visit or provider delivery.
