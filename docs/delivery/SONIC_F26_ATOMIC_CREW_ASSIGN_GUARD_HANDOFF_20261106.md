# SONIC F26 — Atomic crew-ready ASSIGN safeguard · review-only SQL + PG17

Date: November 6, 2026. Feature Development Chat. Existing **DRAFT PR #915**; no new PR or live SQL changes.

## Actual defect and desired invariant

The historical `supabase/migrations/0011_visit_field_runtime.sql` `servicedesk_transition_visit(ASSIGN)` validates a non-null crew ID but does **not** check `crews.active`, same-branch request/slot/crew, or any `crew_members.active` plus matching `memberships.role=CREW/status=ACTIVE`. The recent F26 server-side readiness checks reject inactive crews, but a concurrent member/crew revocation between the app check and SQL commit can bypass those checks.

**Candidate:** `docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql` adds a SECURITY INVOKER BEFORE INSERT/UPDATE trigger, sorted after normal branch-row normalization. It fires when a visit enters ASSIGNED or is reassigned to a different crew/slot/request/branch, regardless of whether it came through the 0011 transition RPC, 0018 assignment RPC, or direct SQL. It validates workspace+branch+request, active crew, matching branch slot, and one active crew member with ACTIVE workspace CREW membership. It holds PostgreSQL **FOR SHARE** locks on the matched request, crew, slot, crew_member and membership rows until commit. A competing revocation/update waits, and ASSIGN fails if the revocation commits first. It never sends a customer/provider message, creates a payment, or inserts a visit/outbox event. No elevated trigger function owner.

**Limit:** This proves crew readiness **at assignment commit**. It cannot promise that a crew stays active indefinitely after commit. This does not verify sufficient skills, working hours, travel time, location, billing or actual provider calendar delivery. A production DBA must separately review ordering of triggers, existing RLS/permissions and multi-tenant branch migration 0053/0062, lock contention, deadlocks, migration rollout/rollback and long-running transactions before any install. A historical already-ASSIGNED row is not silently revalidated on unrelated edits.

## Disjoint workstreams

- SQL/security candidate: `docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql` — source only, no migration registration and no Supabase execution.
- PG17 fixture: `tests/sql/v4-f26-atomic-crew-pg17-fixture.sql` — isolated fictional tenant, branch, owner and crew member.
- PG17 acceptance: `tests/sql/v4-f26-atomic-crew-pg17-acceptance.sql` — extracts the **unaltered original 0011 visit RPC** into disposable DB, rejects revoked membership, wrong role, inactive crew/member, cross-branch resources and direct SQL bypass. Successful assignment must emit exactly one internal calendar outbox event; same-version replay must fail.
- Transaction race: `scripts/release/v4-f26-pg17-crew-revocation-race.sh` — two real PostgreSQL sessions with a held membership update and lock-timeout witness (SQLSTATE 55P03), followed by committed-revocation ASSIGN denial (23514) with no changed visit/outbox. Strict local host + DB name + source SHA guard, abort on ambiguous result.
- Independent Critic: `tests/ai/f26-atomic-crew-pg17-critic.test.ts` — source ACL, concurrency lock, real original RPC and no live deployment.
- Integrator: one new `native-pg17-f26-atomic-crew` job in the existing #915 GitHub Actions workflow; no device runner or background services after run.

## Release and owner authorization

Connected Supabase project `cpmmgivhlkfbiwzhlcey` is **INACTIVE** at read-only `get_project`; P02 #818 distinct two-owner acceptance and P03 #819 genuine pricing/booking remain OPEN. NO connected database restore, CLI, SQL apply, schema/Auth/tenant writes, Vercel deploy, customer messaging, provider sends, fees, main/canonical merge or F26 flag activation is part of this work.

**Operational NEXT:** Production owner + human DBA decide whether to authorize project reactivation/restore with cost and backup analysis; review exact SQL candidate, authorize a separate schema change and controlled rollback (if appropriate), then test real owner-A/B JWT/RLS/branch and concurrent membership revocation in approved staging. Source-green PG17 CI is not a production receipt and does not grant authorization.
