# F26 integration reconciliation — SQL trigger alignment and dual rollout lock

**Scope:** existing [DRAFT PR #915](https://github.com/SaamVR/ServiceDesk/pull/915). The separate SQL/DBA lane has already installed the **source-only** candidate `docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql` into its disposable PostgreSQL 17 test database, NOT connected Supabase.

## Real integration mismatch fixed

The app's `readActiveBookedVisitCrew` previously treated memberships in roles OWNER, DISPATCHER or CREW as valid active crew; the reviewed PostgreSQL trigger authorizes only `m.role='CREW'`. A booked visit with active owner/dispatcher roster but no CREW role could have passed the app's readiness check, displayed dispatch as available, and then failed the transaction trigger.

The application now requires exact same-workspace ACTIVE **CREW** membership, matching the real trigger. The query filters `role=CREW`, and the post-query validation refuses any unexpected role. Adversarial tests include OWNER and DISPATCHER as negative crew evidence while preserving the actual signed-in OWNER authority for the dispatch action.

## Two independent default-OFF rollout switches

The existing `SERVICEDESK_F26_OWNER_DISPATCH_ENABLED` is not sufficient to enable dispatch. The server and owner receipt UI now also require **`SERVICEDESK_F26_ATOMIC_GUARD_APPROVED=true`**, default OFF. An owner/DBA must separately authorize exact installation of the atomic ASSIGNED crew guard, verify live migration ledger and rollback, approve tenant-A/B authenticated isolation under P02, verify genuine P03 rates, and approve deployment before either switch is enabled. The conditional cannot verify the database migration automatically and must never be described as a live installation proof.

The source-only SQL candidate has an independent real PostgreSQL 17 replay/role/revocation/lock-wait gate in the existing IR21 CI. This code alignment does **not** duplicate that SQL candidate, create another workflow, modify the original 0011 migration, or create a new PR.

## Ownership and next work

- Feature backend: `f26-active-crew-readiness.ts` and `owner-verified-booking-dispatch.ts`.
- Owner UI: additive flag check in `OwnerSavedBookingReceiptPanel.tsx`.
- QA+security critic: three existing F26 tests plus independent PG17 critic updated.
- Integrator: existing draft #915, exact Git blob hashes in `sonic-f26-trigger-integration-dual-guard-source-lock-20261106.json`, one existing CI pass.
- Production/P02: review Supabase `INACTIVE` state and obtain explicit authority for restoration/cost/backup scope; two genuine owner sessions with cross-tenant deny.
- DBA: audit trigger security/ownership/branch dependencies and actor revocation races before any connected installation.
- Production/P03: verify real catalog and branch pricing records, paid booking, and one authorized dispatch before release.

**Prohibition:** no connected database SQL, Auth creation, project restore/restart, customer/provider send, payment mutation, F26 switch activation, deployment or main/canonical merge occurs in this source reconciliation.
