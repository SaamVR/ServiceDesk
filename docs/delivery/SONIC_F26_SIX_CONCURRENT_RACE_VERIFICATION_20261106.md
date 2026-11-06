# SONIC F26 — Six independent PostgreSQL 17 revocation/branch races

**Date:** November 6, 2026 · **Feature Development** · **single existing draft PR #915**. This adds regression evidence to source-only SQL candidate `docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql`. No production installation or F27 feature.

## Why this batch

The original isolated PostgreSQL 17 acceptance exercised one real two-session row-lock race: changing `memberships.status` from ACTIVE to REVOKED while the original 0011 `servicedesk_transition_visit(ASSIGN)` executed. The trigger ALSO locks requests, crews, capacity slots, crew members, and `memberships.role`; claiming all of those concurrency surfaces safe solely from one witnessed race would exceed the evidence.

## Lanes and verified proof criteria

**DB concurrency lane:** `scripts/release/v4-f26-pg17-crew-revocation-race.sh` now runs six **separate** opposing transactions with a fresh fictional source reset before each: (1) membership status revoked, (2) CREW role changed to DISPATCHER, (3) crew deactivated, (4) crew member deactivated, (5) request moved to another branch, and (6) capacity slot moved to another branch. A writer holds the exact row through a 4-second barrier while a second PostgreSQL connection invokes the **unchanged original 0011 visit RPC**, not a mock. Each candidate must return SQLSTATE 55P03 under an 800-ms lock timeout, then SQLSTATE 23514 after the writer COMMIT, with the visit still SCHEDULED version 1 and **zero outbox events**. A false success, different failure, unobserved row lock, no COMMIT, or changed visit/outbox fails CI.

**Security/Critic lane:** `tests/ai/f26-atomic-crew-pg17-critic.test.ts` pins six distinct cases, database+SHA+localhost safety barriers, original function invocation, both SQLSTATEs and the no-outbox invariant. Historic source-only candidate and its exact Git SHA remain unchanged.

**Integrator/QA lane:** Existing `native-pg17-f26-atomic-crew` job already runs this same script in a localhost Postgres 17 service, seeded with fictional data. CI workflow is reused unchanged, preserving the F15 two native PG17 jobs and the application source test/type/lint/build lanes. Never use a connected Supabase project for this script.

## Operational release boundary

The new race evidence only supports **atomic row-lock behavior in disposable PostgreSQL 17 against extracted 0011 SQL plus the reviewed source-only trigger**. It does not prove installation, grants/RLS under Supabase, JWT owner A/B isolation, provider calendar delivery, active crew after commit, or production booking/dispatch. The two F26 rollout environment switches remain default OFF. Connected Supabase ServiceDesk project was last observed INACTIVE; P02 #818 and P03 #819 remain OPEN.

**NEXT:** Exact-head GitHub Actions verification and independent human DBA review of the trigger candidate, particularly migration 0053/0062 branch triggers, lock order and production restore/rollback. Only explicit owner authorization permits live project reactivation, real SQL migration, signed-in A/B UAT, or flag enablement. Avoid new feature PRs until integration decision.
