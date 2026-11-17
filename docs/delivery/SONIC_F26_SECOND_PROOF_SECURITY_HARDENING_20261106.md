# SONIC F26 pre-transition booking-proof revalidation — 2026-11-06

**Scope:** strengthen existing F26 draft source in [PR #915](https://github.com/SaamVR/ServiceDesk/pull/915), not a new feature or live activation. **Source parent** `2da5ad71b6f66b94b1e0ef1bcd732567b44fd42f`.

## Defect discovered by independent security lane

The original F26 owner dispatch handler validated the *first* F25 `SAVED_BOOKING_WITH_APPLIED_DEPOSIT` receipt with `recordedDepositApplication=true` and `bookingRecordPresent=true`, but the **second pre-write saved receipt** checked only visit status, visit ID, invoice ID, quote revision, and visit start. A contradictory second receipt with missing deposit evidence, no saved booking, different quote ID, or an unexpected receipt state could pass that second guard and reach the existing `transitionOperationalVisit(...,"ASSIGN")`. The ordinary F25 loader currently fails closed on these conditions, so this was a missing **defense-in-depth assertion**, not demonstrated live unauthorized dispatch.

## Changes

- Backend `src/server/workflows/owner-verified-booking-dispatch.ts`: require second pre-transition receipt `state=SAVED_BOOKING_WITH_APPLIED_DEPOSIT`, exact selected quote ID and visit ID, `recordedDepositApplication=true`, and `bookingRecordPresent=true`, in addition to pre-existing same-owner, same-invoice/version/start and SCHEDULED checks.
- Adversarial QA `tests/ai/f26-owner-verified-booking-dispatch.test.ts`: independently inject contradictory second proofs (wrong quote, wrong receipt state, revoked applied deposit, revoked saved booking), verifying no state transition occurs even if first proof was valid.
- Independent Critic `tests/ai/f26-owner-verified-booking-dispatch-critic.test.ts`: pins complete second-read evidence guards in addition to prior F26 payment, owner, version and outbox requirements.
- No route/flag changes and no new booking, payment, outbox, customer-message, Vercel deployment, SQL migration, user provisioning or merge.

**Source lineage:** F26 original source-lock `docs/delivery/sonic-f26-verified-booking-dispatch-source-lock-20261106.json` is preserved as **historical provenance**. This handoff records the specific additive F26 successor hardening; do not rewrite earlier blob hashes as though the original source remained unchanged.

**Production blocker (read-only check 2026-11-06):** Supabase `cpmmgivhlkfbiwzhlcey` remains `INACTIVE`; P02 #818 and P03 #819 remain OPEN, and real two-owner/JWT/tenant-A/B validation is not available from a green source CI. Restoring the DB may have operational/cost impact and requires explicit owner authorization. Keep the F26 server flag OFF by default and retain human/DBA veto.

**NEXT TASK:** Production Chat decides whether to authorize restoration/reactivation of the existing ServiceDesk project, two-owner P02 staging UAT and exact-source integration. Feature Chat should not create an F27+ stack or claim production progress without those gates.
