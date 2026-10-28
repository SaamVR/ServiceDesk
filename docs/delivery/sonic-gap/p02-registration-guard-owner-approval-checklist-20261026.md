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

## Transaction-stable approval row locks (source-only, 2026-10-26)

The registration candidate originally evaluated the operator's singleton `CLOSED/QA_ONLY/PUBLIC` mode and the exact user's expiring QA grant, then made several workspace, owner, branch and audit inserts without retaining a row lock on either approval record. A concurrent operator could commit a CLOSED switch or revoke the QA grant while an already-admitted registration remained in progress. The source now takes `SELECT ... FOR SHARE` on the singleton mode row and, only for QA_ONLY, the exact active grant row. It always locks mode before grant. These locks permit simultaneous approved registrations but serialize conflicting operator UPDATE/DELETE calls **until the registration transaction commits or rolls back**. Reference: [PostgreSQL 17 row-level locking](https://www.postgresql.org/docs/17/explicit-locking.html).

**Exact semantics:** This is not cancellation of an already-admitted registration, nor assurance that expiry cannot pass after the initial gate; `CLOSED` takes effect once transactions admitted before the operator's UPDATE release their row locks. An operator must wait for outstanding registrations to end and verify mode CLOSED afterward. Expiring grants are checked against `clock_timestamp()` while locked; concurrent revoke waits for that transaction. The original existing-owner idempotence path remains intentionally available even under CLOSED mode.

An additional **two-session disposable PostgreSQL 17 CI** now starts a verified synthetic registration transaction and holds it open, independently attempts to update the singleton mode and revoke that user's grant with short lock timeouts, requires both to fail with the expected lock-conflict timeout, then rolls back the original owner registration and verifies no workspace, audit or approval changes survived. It restores the disposable database CLOSED and deletes only its fictional test grant/user. The shell script checks the expected local PostgreSQL host, port, database name, role and disposable password before ANY test write. No production credential or real Supabase connection is used.

**Approval remains blocked:** This is additional source contract testing, not an applied migration or authorized customer-facing rollout. Independent DBA review should confirm lock ordering/latency, migration ledger and rollback and investigate any effect of database isolation settings or administrative lock timeouts. No direct main Supabase SQL, user creation, Vercel deployment or provider action is authorized.

## Operator-first concurrency proof — opposite ordering (source only)

The existing two-session PostgreSQL 17 regression proves **registration-first** precedence: once registration acquires the mode/QA grant row locks, later operator attempts to update CLOSED or revoke its grant block until registration ends. This additional disposable regression proves the reverse **operator-first** precedence under PostgreSQL's READ COMMITTED locking rules: an operator opens a transaction, changes the mode to CLOSED or revokes the exact user grant, then waits before committing. A new-owner registration attempt started after the uncommitted operator change waits, rechecks the committed row, returns `REGISTRATION_NOT_AUTHORIZED`, and does not save a workspace or audit row. The script first proves this same fictional owner can register under an otherwise valid QA_ONLY grant, rolling that precondition transaction back; so a broken registration routine cannot falsely pass through blanket denial.

The disposable CI requires both `P02_OPERATOR_CLOSED_WINS_PASS` and `P02_OPERATOR_REVOCATION_WINS_PASS`, plus final `P02_OPERATOR_FIRST_CONCURRENCY_PASS`. It restores the CLOSED mode and removes only the fictional test actor/grant. A strict host/port/database/password guard refuses non-disposable execution. These concurrency tests do **not** provide real Supabase tenant acceptance or guarantee behavior under deliberately different transaction isolation levels. Source: [PostgreSQL 17 READ COMMITTED row recheck rules](https://www.postgresql.org/docs/17/transaction-iso.html) and [row lock semantics](https://www.postgresql.org/docs/17/explicit-locking.html).

**Production boundary remains the same:** No main SQL installation, migrations, verified QA account provisioning, customer request writes, provider calls, or Vercel deployment can occur without explicit owner permission and independent DBA review. This source proof improves the DBA's decision evidence only.

## P18 postinstallation read-only CLOSED attestation (separate source gate)

The **preinstallation** check `docs/engineering/security/p02-registration-live-readonly-preflight.sql` must PASS against an explicitly DBA-approved and backed-up *original* main DB preimage immediately before any *separately authorized* installation. Once a reviewed and separately owner-authorized corrective migration is applied, that PRE-install gate will correctly BLOCK: a changed registration function is no longer the original. Do not rerun the preinstallation gate and treat its expected failure as a failed installation.

The newly authored **postinstallation** check is `docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql`. It runs in a **READ ONLY transaction**, requires the exact private schema/control tables and guarded registration RPC, singleton `CLOSED` default, **zero existing registration QA grants**, protected RLS without client table policies, denied private schema/table/anonymous and PUBLIC function access, verified function owner `postgres`, SECURITY DEFINER + pinned search_path, safety-critical authorization logic and untouched 0065 branch-function checksum. It returns `P02_REGISTRATION_POSTINSTALL_CLOSED_PASS` only when every condition holds; otherwise it exits nonzero with `P02_REGISTRATION_POSTINSTALL_BLOCKED`. <Link> is not required; this is an internal operator artifact.

The attestation also pins the exact guarded function body digest `b24154db78c5f1b210f86c97f896d44d` from the disposable PostgreSQL 17 candidate installation. This is stricter than checking the presence of important authorization words: even a comment-only `CREATE OR REPLACE FUNCTION` change must BLOCK. Independent source review is required before changing this expected digest; do not automatically accept an unknown live body hash.

The **zero-grant condition is deliberate**: this attestation is a receipt at the narrow installation boundary, **before any QA-only identities, grants, or fixture records are created**. Once an authorized operator later grants a QA user, this postinstall attestation should BLOCK rather than pretending to be a general operational monitoring check. Future operational monitoring needs separately reviewed semantics and must not relax this installation receipt.

GitHub CI creates another *disposable* PostgreSQL 17 database, starts from reviewed 0059+0065, applies the source guard only in that disposable database and executes the postinstall check. Eight independent source adversaries (premature QA_ONLY, premature grant, anonymous RPC EXECUTE, PUBLIC RPC EXECUTE, private schema USAGE, disabled RLS, SECURITY INVOKER and comment-only function body drift) must all produce nonzero exits and the correct BLOCKED marker. A fully restored CLOSED baseline must PASS again.

**Production sequencing, never automated from Feature Chat:** independent DBA approval of source SHA/migration-0065 reconciliation/function and table ACL snapshot/backups/rollback → explicit owner approval for the exact installation SQL and target → installation with mode CLOSED and no grants → read-only postinstallation receipt → separate owner approval to create one additional fictional verified Auth OWNER, an isolated workspace/default branch and saved synthetic request → real independently signed-in JWT/browser/RLS negative-tenant tests → approval of one integration route; hosting only with independently explicit target/SHA/environment permission. A green disposable CI receipt is **not** evidence of live main installation, and this source document does not authorize SQL, Auth users, providers, payments, device cleanup or deployment.

## Emergency containment and rollback safety

**Preferred emergency response:** Using a separately authorized privileged, audited operation, set the database `owner_registration_control.mode` back to `CLOSED`. This preserves existing owner workspaces, audit events, and approval records while refusing new workspace creation. The disposable PG17 fixture proves that a signed-in unapproved account remains denied and existing-owner idempotent readback still works.

**Do not revert blindly to the original 0059 RPC**: that would reopen the server-bypass vulnerability. Any structural rollback, such as restoring the prior function definition or dropping protected tables, must be independently approved with a recorded preimage, backups, migration ledger accounting and a non-destructive retention policy; no automatic `DROP ... CASCADE` is authorized. In an incident, keep the protected schema and CLOSED gate until the operator completes a reviewed recovery.

**QA identity cleanup:** The private grant uses an `auth.users` foreign key with `ON DELETE CASCADE`, so a separately authorized deletion of an *unregistered fictional QA user* cannot leave stale approval rows or be blocked by this grant table. It does not authorize deleting existing owners or workspaces. Preserve independently required audit/approval evidence before any deletion; do not automatically remove registered tenant records.

## Read-only exact-preimage database gate (source candidate, 2026-10-26)

Before any separately approved DDL, a designated DBA can execute `docs/engineering/security/p02-registration-live-readonly-preflight.sql` using `psql -v ON_ERROR_STOP=1 -f ...` on the **explicitly approved** database connection. It begins a read-only transaction; no fixtures, role grants or deployments are created. It exits nonzero if the exact existing owner-registration function MD5 is not `e4de11c0b1b6736e46e201ee491d908f`, the existing repaired default-branch function MD5 is not `9f14160f16e16ffe6ac16f35c3f4557f`, anonymous function execution has widened, authenticated execution is absent, the SECURITY DEFINER flag differs, or the proposed protected schema already exists. This is a narrow **function/preimage** check only; migration ledger review (0065 installed, 0063/0064 unresolved), full schema compatibility, backup and rollback require independent DBA signoff. A PASS is NOT installation approval.

## SECURITY DEFINER search_path preflight condition

The existing owner-registration function runs as `postgres` with a `pg_catalog, public, pg_temp` search path. Live read-only privilege checks on 2026-10-26 established `anon` and `authenticated` both **lack** `CREATE` on the `public` schema. The preflight now rejects any future `CREATE` grant to either API role, preventing installation from proceeding on a drifted schema-permission boundary without explicit DBA review. It does not authorize broad privilege changes; in particular, do not grant API roles `CREATE` to repair an installer failure.

## Additional fail-closed preflight adversarial proof — disposable PG17

The existing after-install negative check is supplemented with an isolated disposable PostgreSQL 17 database reconstructed from 0059 plus 0065. The gate must first PASS on the untouched baseline; separately granting anonymous EXECUTE, removing SECURITY DEFINER, or altering the registration function source fingerprint must each make the exact read-only preflight exit nonzero with `P02_REGISTRATION_READONLY_PREIMAGE_BLOCKED`. All temporary drift is reversed and the final baseline must PASS again. The previously added public-schema CREATE-permission deny checks remain unchanged. This guards against a misleading green test caused by a permanently damaged fixture.

No main database SQL, user/account provisioning, deployment or data mutation is authorized. Independent DBA verification of the exact live preimage, complete privileges, migration ledger and rollback is required immediately before any separately approved installation.

## Privileged function ownership is part of the read-only preimage

The protected preflight checks both `SECURITY DEFINER` functions' **effective owners** are exactly `postgres` in the already-verified main ServiceDesk Supabase project: `public.servicedesk_register_owner_workspace(text,text,text,text)` and installed-0065 `public.servicedesk_default_branch(uuid)`. Reassigning function ownership can change the effective privileges used during execution **without changing the source checksum or SECURITY DEFINER flag**. An isolated PostgreSQL 17 negative fixture now tests temporary `ALTER FUNCTION ... OWNER TO` drift for each function and restores the expected owner before the final positive PASS. This adds no main-database DDL authorization, user or fixture creation, deployment, or migration installation.

## Rollback must never re-open the direct owner registration RPC (source-only, 2026-10-26)

**Critical sequencing:** the original `0059` function verifies email but has no database-side registration approval. PostgreSQL's `CREATE OR REPLACE FUNCTION` retains the function's prior owner and `EXECUTE` ACL. Therefore merely replacing the guarded function with the original while `authenticated` still has `EXECUTE` would silently re-enable workspace creation for any confirmed signed-in account. See [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).

For a separately approved database rollback, choose a safe containment policy first. **Fail-closed rollback sequence:** (1) halt new registrations, retain the audited snapshot and real operator approvals; (2) inside an explicitly authorized and reviewed migration transaction revoke registration RPC execution from `PUBLIC`, `anon` and `authenticated` **before** restoring the original `0059` function; (3) restore the exact signed-off function preimage and retire the protected registration tables/schema only after dependency review; (4) verify the original function checksum is restored **and direct authenticated/anonymous RPC access remains DENIED**, using independently approved safe checks; (5) preserve this denial until a separately approved replacement authorization mechanism is installed. Do NOT restore the old authenticated `EXECUTE` ACL automatically.

An independent **disposable PostgreSQL 17 rollback rehearsal** now snapshots the exact `0059` function definition/MD5, installs the guarded candidate, revokes RPC execution, restores the original via `pg_get_functiondef` snapshot, drops only the synthetic protected schema, confirms the original hash and remaining revocation, and verifies an `authenticated` role cannot register or create a workspace. It refuses any database other than `servicedesk_p02_registration_rollback`. This test does **not** establish a production rollback plan for real data/grants, active long-running sessions, extensions, saved workflows, pending communications or out-of-order migrations. A human DBA must review protected backups, schema dependencies, transaction locking and owner-approved rollback authority.

The existing installation and QA identity gates remain unchanged. No main Supabase SQL or user creation is authorized.


## P18 independent ACL-completeness correction (source-only, 2026-10-27)

An independent review identified that the first postinstall receipt checked only selected table rights. PostgreSQL 17 has eight table rights (including `MAINTAIN`) and four possible column-level grants. The stricter receipt enumerates all eight rights for both API roles and both protected tables, plus effective column-level `SELECT`, `INSERT`, `UPDATE`, and `REFERENCES`. New disposable PG17 adversarial tests inject authenticated `DELETE`, anonymous `MAINTAIN`, and anonymous column-only `SELECT(mode)` independently and require nonzero BLOCKED, then verify a restored final PASS. Source evidence only; does **not** change or authorize live Supabase or QA provisioning. Official PostgreSQL reference: https://www.postgresql.org/docs/17/functions-info.html

## P18 constraint-integrity follow-up (source-only, 2026-10-27)

The immediate CLOSED/zero-grants attestation also verifies the *schema contract*, not just current rows: two primary keys, singleton and mode CHECK constraints, the Auth user foreign key with cascading deletion, and required non-null fields. An additional disposable PostgreSQL 17 adversary drops the mode CHECK constraint while leaving the CLOSED row intact; the receipt MUST block and a repaired final baseline MUST pass. This does not authorize Production installation. No user IDs are printed.

## P19 read-only receipt: default and function-GUC exactness (source-only, 2026-10-27)

Postinstall receipt now rejects a drifted default of `PUBLIC` on the CLOSED-mode control, absence of the `singleton = true` default, and any additional function-level GUC beyond the reviewed `search_path=pg_catalog, public, pg_temp`. A currently CLOSED row alone is insufficient to prove safe future inserts. Three isolated PostgreSQL 17 adversarial cases mutate and restore only disposable fixtures, each requiring a marked nonzero BLOCK and a final baseline PASS. No main Supabase SQL or user/account/fixture or deployment authority is implied.

## P20 exact DDL/owner integrity attestation (source-only, 2026-10-27)

The reviewed P02 SQL is still **NOT INSTALLED**. The postinstall receipt must not treat mode CHECK as valid only because its textual definition *mentions* CLOSED/QA_ONLY/PUBLIC. A tautological `OR TRUE` extension could preserve all those strings while removing the constraint's enforcement. P20 replaces substring checks with the exact PostgreSQL 17 mode CHECK representation, requires constraints to be validated, and keeps the precise Auth FK cascade definition.

The same read-only gate rejects drift to either private table owner or security schema owner, extra user-defined triggers on the protected control/grant tables, and rewrite rules. FK-generated internal triggers are expected and intentionally exempt. Five new disposable PG17 adversarial scenarios each have to return a nonzero marked BLOCK and a complete restored final PASS: `MODE_CHECK_WEAKENED`, `SCHEMA_OWNER_DRIFT`, `TABLE_OWNER_DRIFT`, `EXTRA_TRIGGER`, `EXTRA_RULE`.

**Authority unchanged:** tests execute only on fixed-name local PostgreSQL 17 CI database. They are not production rollback approval, guard installation permission, QA account authorization, genuine signed-in JWT/browser RLS acceptance, or deployment authority.

## P21 pre-install migration ledger reconciliation (source-only, 2026-10-27)

Independent live read-only catalog and Supabase migration history inventory confirms 70 recorded migrations, including `sd_0062_v4_branch_trigger_rowtype_guard` (`20261012105723`) and the out-of-order installed `sd_0065_v4_default_branch_membership_authority` (`20261025200147`); 0063 and 0064 are **not** recorded. This is not permission to install them. The existing reviewed registration preflight's ten checks currently pass on main, but the guarded registration schema is **absent**, so signed-in callers still execute an unguarded owner registration RPC.

Before any future separately owner-approved guarded migration, the DBA must run BOTH read-only gates:
1. `docs/engineering/security/p02-registration-live-readonly-preflight.sql` — exact live preimage and privileges.
2. `docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql` — exact 0062 + 0065 ledger state, no 0063/0064 recorded, and no reused/relabelled migration entries.

**Use `psql -X -v ON_ERROR_STOP=1 -f` on the intended live database**, with read-only credentials if available. STOP on any missing `...PASS`, even if another gate passes. Never use `db push` to automatically reconcile the out-of-order ledger. A *separate* owner-reviewed migration sequence plan and exact authority are required; the gate is not a migration installer.

P21 disposable PostgreSQL 17 workflow tests seven independent mutation-and-restore scenarios against a synthetic local `supabase_migrations.schema_migrations` fixture, never against Supabase: missing/renamed 0062 or 0065, accidentally recorded 0063/0064, duplicate 0065 under a changed version. Each must fail with the ledger-specific BLOCK marker, and a restored final PASS is mandatory. These are source-only dry-run proofs and cannot assert real JWT/browser acceptance or release readiness.

### P21 independent suffix-replay correction

Migration history already uses letter-suffixed names (e.g. `sd_0012a_*`). Ledger gate now catches any 0063/0064 prefix, including `sd_0063a_*` and `sd_0064a_*`. Two extra disposable PostgreSQL 17 negative cases `UNREVIEWED_0063A` and `UNREVIEWED_0064A` prevent this exact false-green. Total ledger cases: **nine**, with a restored final positive baseline.

## P22 same-database installation-to-rollback rehearsal (SOURCE-ONLY, 2026-10-28)

The P21 read-only ledger guard and the P20 CLOSED postinstall receipt previously passed in independent PostgreSQL 17 fixtures. P22 now integrates them into the **existing disposable rollback database** `servicedesk_p02_registration_rollback` with an explicit fixed-database-name guard:

1. Populate the existing synthetic Auth/workspace/0059 and approved 0065 source preimage; require `P02_REGISTRATION_READONLY_PREIMAGE_PASS`.
2. Populate a **synthetic**, two-entry 0062/0065 migration ledger (0063/0064 absent); require `P02_MIGRATION_LEDGER_READONLY_PASS` before installing anything.
3. Install the exact P02 candidate SQL **only inside the named disposable PG17 database**; verify the singleton mode is `CLOSED`.
4. On that same installed database run `p02-registration-postinstall-readonly-attestation.sql` and require `P02_REGISTRATION_POSTINSTALL_CLOSED_PASS`.
5. Exercise the existing **revoke EXECUTE first → restore original reviewed function → drop disposable guard** fail-closed recovery. Require `P02_FAIL_CLOSED_REGISTRATION_ROLLBACK_PASS` plus actual authenticated-role `insufficient_privilege` denial and zero unauthorized workspace creation.
6. Re-run the read-only 0062/0065 ledger gate on **that same database** *after rollback*. The ledger must still match its original identity and sequence.

The P22 fixture is `tests/sql/p02-registration-rollback-ledger-disposable-setup-pg17.sql` and is wired to the pre-existing rollback step in `.github/workflows/p02-owner-registration-candidate-pg17.yml`. These are simulation receipts; they do not prove real Supabase backup restoration, real signed-in Auth JWT/RLS boundaries, independently created second QA owner, or the safety of applying an unreviewed migration history in Production.

**Production DBA authority is STILL NOT GRANTED.** The only acceptable live approval path remains: record target project and exact reviewed migration blob; independently verify database backups and recoverability, fresh 10-condition preimage and out-of-order 0065 ledger, transaction/locking and provider impacts; get exact owner approval for security-only installation with default `CLOSED`; immediately run the strict read-only postinstall receipt; stop on any drift. No `db push`, fixture creation, customer-data touch, grant to QA users, or Vercel deployment follows automatically. If restoration becomes necessary, it requires separately scoped privileged authority and a live-specific operator-approved script; the disposable rollback fixture MUST NEVER be run on any live database.
