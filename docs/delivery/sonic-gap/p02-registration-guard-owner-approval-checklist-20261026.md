# P02 database-side registration guard — source candidate only

**Status: NOT INSTALLED.** This file and SQL candidate are not deployment, migration, account creation or synthetic data authorization. NEXT_BATCH=P02.

## Risk and design
The existing public registration RPC is SECURITY DEFINER and executable by authenticated users. It verifies signed-in email but does not enforce the Next-only QA registration allowlist. A caller with a separate confirmed Supabase identity can potentially invoke the RPC directly; the issue is independent of application UI flags.

The source candidate at docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql supplies protected database tables, a CLOSED default, QA_ONLY exact authenticated user-ID grants with expiry and revocation, and explicit future PUBLIC mode. Control tables are under a non-exposed security schema, RLS enabled, and no client table grants. Existing real-owner idempotence and atomic workspace/default branch/membership/audit writes are preserved.

## Priorities and mandatory release conditions
1. Obtain separate owner approval for the reviewed schema/RPC change, migration order and rollback. The main database has security patch 0065 installed, while source migrations 0063/0064 remain unapplied and unapproved. Do not deploy a migration merely because a candidate CI run passes.
2. Independently review PostgreSQL role, schema, table and RPC grants, search_path, auth.uid source, approval expiry, revocation, advisory-lock behavior, and default CLOSED mode. Capture a protected preimage of actual function/ACL and validate read-only checks.
3. Source PR must pass exact-head Next/Vitest/type/lint/build, automated independent Critic and PR merge-tree parity. Disposable PG17 service must prove CLOSED refusal, QA_ONLY no-grant/expired/revoked refusal, distinct approved owners, idempotence, branch/audit state, and PUBLIC gated behavior.
4. Only upon explicit approval, generate a named, immutable corrective migration from this source candidate using the supported Supabase CLI, review numbering/ledger safety, perform a dry-run on an authorized disposable or isolated target, document exact rollback and independent database approval. Never apply to existing main simply to exercise tests.
5. Real UAT needs two approved fictional, independently verified owner identities and isolated synthetic scope in the existing main Supabase, without any real customer record mutation. No new users/JWTs/fixtures until explicit owner authorization. Sensitive values stay in a secure secret store, not public issues.
6. Vercel requires separate exact project/SHA/environment approval; do not import, create, link, preview, stage, deploy, pay, or expose. Source vercel.json must retain automatic Git deployments disabled.

## Evidence classification
Passing candidate CI means CONTRACT_TESTED for the proposed SQL in disposable PostgreSQL, not main database remediation, tenant RLS acceptance, provider verification, staging readiness or commercial production release.

**NEXT_BATCH=P02 — complete the owner-approved DB guard and genuine two-owner onboarding/RLS acceptance before advancing P03.**

## Long-running transaction QA grant expiry (source correction, 2026-10-26)

PostgreSQL `now()` and `transaction_timestamp()` return the **transaction start** timestamp. A QA grant that expires while a transaction is open could therefore remain acceptable to the original candidate guard. The corrected candidate compares the NOT NULL `expires_at` against `pg_catalog.clock_timestamp()` at the registration check and rejects revoked, missing or expired grants even after a transaction outlives its deadline. Source: [PostgreSQL 17 date/time functions](https://www.postgresql.org/docs/17/functions-datetime.html).

The disposable PostgreSQL 17 regression now inserts an expiring grant within a transaction, waits beyond its expiry and attempts **new-owner** registration in that same transaction. It must fail with `REGISTRATION_NOT_AUTHORIZED` and roll back with no persisted grant/workspace. Existing valid fresh QA grant, revocation, duplicate-owner idempotence, CLOSED kill switch and email verification tests remain required.

**Security limitation:** This deadline check narrows the transaction-clock bypass but is not proof of concurrent independent transaction revocation and is not installation approval. Source and PG17 tests must be verified at the **updated draft exact SHA**. Do not apply SQL on existing main, do not create a user or workspace, and do not deploy without explicit separately scoped Production authorization.

## Emergency containment and rollback safety

**Preferred emergency response:** Using a separately authorized privileged, audited operation, set the database `owner_registration_control.mode` back to `CLOSED`. This preserves existing owner workspaces, audit events, and approval records while refusing new workspace creation. The disposable PG17 fixture proves that a signed-in unapproved account remains denied and existing-owner idempotent readback still works.

**Do not revert blindly to the original 0059 RPC**: that would reopen the server-bypass vulnerability. Any structural rollback, such as restoring the prior function definition or dropping protected tables, must be independently approved with a recorded preimage, backups, migration ledger accounting and a non-destructive retention policy; no automatic `DROP ... CASCADE` is authorized. In an incident, keep the protected schema and CLOSED gate until the operator completes a reviewed recovery.

**QA identity cleanup:** The private grant uses an `auth.users` foreign key with `ON DELETE CASCADE`, so a separately authorized deletion of an *unregistered fictional QA user* cannot leave stale approval rows or be blocked by this grant table. It does not authorize deleting existing owners or workspaces. Preserve independently required audit/approval evidence before any deletion; do not automatically remove registered tenant records.

## Read-only exact-preimage database gate (source candidate, 2026-10-26)

Before any separately approved DDL, a designated DBA can execute `docs/engineering/security/p02-registration-live-readonly-preflight.sql` using `psql -v ON_ERROR_STOP=1 -f ...` on the **explicitly approved** database connection. It begins a read-only transaction; no fixtures, role grants or deployments are created. It exits nonzero if the exact existing owner-registration function MD5 is not `e4de11c0b1b6736e46e201ee491d908f`, the existing repaired default-branch function MD5 is not `9f14160f16e16ffe6ac16f35c3f4557f`, anonymous function execution has widened, authenticated execution is absent, the SECURITY DEFINER flag differs, or the proposed protected schema already exists. This is a narrow **function/preimage** check only; migration ledger review (0065 installed, 0063/0064 unresolved), full schema compatibility, backup and rollback require independent DBA signoff. A PASS is NOT installation approval.

## SECURITY DEFINER search_path preflight condition

The existing owner-registration function runs as `postgres` with a `pg_catalog, public, pg_temp` search path. Live read-only privilege checks on 2026-10-26 established `anon` and `authenticated` both **lack** `CREATE` on the `public` schema. The preflight now rejects any future `CREATE` grant to either API role, preventing installation from proceeding on a drifted schema-permission boundary without explicit DBA review. It does not authorize broad privilege changes; in particular, do not grant API roles `CREATE` to repair an installer failure.
