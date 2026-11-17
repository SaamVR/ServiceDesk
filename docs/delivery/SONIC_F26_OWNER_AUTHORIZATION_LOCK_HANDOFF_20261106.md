# SONIC F26 — Atomic owner authority and direct actor-ID integrity

**Repository:** SaamVR/ServiceDesk. **Source parent:** `d79712f39b91a86da663ae35072149a5e5a6ab63`. Existing draft PR #915. **Date:** 2026-11-06. **Status:** REVIEW-ONLY / NOT INSTALLED.

## What was missing

The existing migration `supabase/migrations/0011_visit_field_runtime.sql` computes `v_staff` using an unlocked `EXISTS` query on `memberships`; a membership could be revoked or demoted between the permission lookup and a visit's `SCHEDULED→ASSIGNED` write. The separately reviewed F26 **crew** trigger locks crew membership, not the actor whose authorization was used. These are two distinct proofs.

The original RPC also accepts `actorUserId` and `actorRole` in its JSON argument. The app currently supplies trusted server-derived identity, but direct `authenticated` PostgREST calls must not be able to impersonate someone else's owner ID if the RPC/table grants permit the call. The original function is `SECURITY INVOKER`; RLS can still deny some callers, but RLS alone should not be claimed to bind the JSON actor ID to the JWT.

## Implemented SQL source candidate (separate from crew trigger)

`docs/engineering/security/f26-owner-role-atomic-assign-rpc-candidate.sql` clones **only** original `servicedesk_transition_visit(jsonb)` at historical blob `4a6d93d2b729be235490c1d39b86e7c6f97f41b2`. It retains `SECURITY INVOKER`, staff/crew permission and all existing visit commands, CAS expectedVersion, visit row `FOR UPDATE`, and calendar outbox insert in the same transaction. It adds two narrow safeguards:

- **Direct JWT identity**: roles `anon` always return `FORBIDDEN`; direct `authenticated` callers must have a non-null `auth.uid()` identical to JSON `actorUserId`, otherwise `FORBIDDEN`. Trusted service-role operations still depend on the existing server's freshly authenticated owner session and the exact saved owner/quote evidence.
- **ASSIGN actor row lock**: at `ASSIGN`, re-select and `FOR SHARE` lock the actual active OWNER/DISPATCHER `memberships` row for the actor before any visit/outbox write. PostgreSQL's row-lock serialization means a revocation committed before the lock is acquired makes this row ineligible; if ASSIGN locks first, a revocation UPDATE waits for its commit or rollback. This closes the actor revocation race separately from crew/member revocation.

**No new RPC, separate release feature, production connection, automatic SQL execution, database migration, provider send, billing or worker activation.** This is a draft replacement, not the production migration ledger.

## Real PostgreSQL 17 acceptance

The *existing* #915 CI F26 disposable job, already verifying original 0011 and the independent crew trigger, now also loads the owner-role candidate. It keeps fictional tenants and identities and adds:
- `v4-f26-owner-jwt-pg17-auth-fixture.sql` — tiny local `auth.uid()` mock reading a fictional JWT-sub GUC; not a real JWT signature or real owner acceptance.
- `v4-f26-owner-atomic-pg17-acceptance.sql` — verifies no visit/outbox on anon, spoofed authenticated actor, revoked OWNER or demoted OWNER.
- `v4-f26-pg17-owner-revocation-race.sh` — real two-session revocation-first lock timeout (SQLSTATE 55P03), assignment-first lock timeout and rollback, after-commit negative proof, plus positive saved ASSIGNED + exactly one outbox.
- `f26-owner-actor-lock-critic.test.ts` — independent source checks on invoker security, double-rollout veto, actor source, real race, and localhost exact SHA guards.

No extra workflow, additional test suite, new PR or changes to the reviewed F26 crew trigger or 0011 historical migration.

## Critical release gates and residual risks

**Both** review-only SQL candidates (crew-status trigger + owner-auth RPC replacement) require exact installed-schema preimage and a separately authorized, rollback-safe production migration; the original migration is NOT edited or reinstalled wholesale. DBA must independently assess lock ordering, direct authenticated RPC EXECUTE grants, revoked token/session behavior, and any later function overrides that could supersede this replacement. A successful fictional PG17 test does not certify real Supabase JWT, RLS, booking/payment or provider delivery.

F26 rollout flags `SERVICEDESK_F26_OWNER_DISPATCH_ENABLED` and `SERVICEDESK_F26_ATOMIC_GUARD_APPROVED` remain independently OFF. P02 issue #818 requires distinct real owner A/B sessions and live negative cross-tenant evidence. P03 issue #819 requires genuine saved catalog/branch pricing. Connected ServiceDesk Supabase was last `INACTIVE`; no restore is authorized. An old V3 Render review deployment is not V4 staging.

**Next:** independent DBA review and approved install preimage/rollback; owner-approved active staging, P02 owner A/B, real pricing/paid booking; then one authenticated F26 UAT with separate calendar delivery proof.
