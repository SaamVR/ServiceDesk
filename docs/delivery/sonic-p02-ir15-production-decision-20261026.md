# P02 IR15 — Joint owner-readback + registration-guard source rehearsal
**SOURCE-ONLY DRAFT / UNMERGED. SQL NOT INSTALLED. NO LIVE TWO-OWNER ACCEPTANCE.**

Control: [#870](https://github.com/SaamVR/ServiceDesk/issues/870), main Production blocker [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818), delivery master [#808](https://github.com/SaamVR/ServiceDesk/issues/808).

## Scope and provenance (exact code, no reimplementation)

| Isolated source owner | Original draft | Pinned source head | Imported Git blobs |
| --- | --- | --- | ---: |
| Post-session owner authority proof | [#868](https://github.com/SaamVR/ServiceDesk/pull/868) | `9df47e173e181cae6345a81f5baf19c2d79a6e1c` | 7 |
| Database registration authorization candidate | [#869](https://github.com/SaamVR/ServiceDesk/pull/869) | `b6fabee30d823e56356c1c40eb59bf404c857dbf` | 13 |
| Registration authorization UX and trusted error source | [#875](https://github.com/SaamVR/ServiceDesk/pull/875) | `908f3a731cc1eab348ee4f07f4f858fc18becbd9` | 5 |

Combined rehearsal pinned over canonical `cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411`. 25 source paths, **no pathname collision**. Twenty added paths, five intentionally modified existing source/test paths. `docs/delivery/sonic-p02-ir15-exact-source-lock-20261026.json` stores PR and Git blob object SHAs. Automated source-lock unit test rehashes **all 25 exact bytes** (Git object format); an independent release critic and this runbook are the only new integration-specific artifacts. None of the original source code bytes were altered or replaced.

## What combined source CI can and cannot establish

- The independent application draft #875 adds truthful operator guidance on database-authoritative `REGISTRATION_NOT_AUTHORIZED` responses and refuses malformed success receipts. Its page renders only recognized registration errors rather than arbitrary caller-controlled `?error=` strings. Existing QA email allowlist remains an app-side guard, not permission to use the direct database RPC. Eight action and four message-origin regression tests provide **source** evidence, not live owner acceptance.


- With both drafts in one tree, execute full Next.js/TypeScript/ESLint source RC, the actual off-line two-owner readback Node integration suite, disposable PostgreSQL 17 role-switch/registration + preflight-negative suite, current merge-tree parity and independent critic integrity, at ONE exact HEAD. All checks must pass and source manifests must remain immutable.
- Readback script requires two **distinct preapproved saved request IDs**, one existing readable request record per owner/tenant. It proves each owner reads its own saved row and cannot read the other's. It retains pinned project GET or known read-only-RPC POST calls, final saved membership/default-branch authority checks AFTER complete A+B audit, and JWT-expiry denial; it does not prove server-side revocation of every in-flight JWT, atomic database snapshots, or the presence of a second real signed-in OWNER.
- Database registration source now holds `FOR SHARE` locks on the singleton mode and exact actor QA approval row until registration transaction finishes. The dedicated **two-session disposable PG17 regression** proves conflicting CLOSED and revocation updates time out while approved registration is in progress, and cleanup rolls back synthetic data. A previously admitted transaction is **not** retroactively canceled by an operator update.
- Two **opposite operator orderings** are tested in independent disposable PostgreSQL sessions. Registration first: operator CLOSED or exact QA grant revocation must wait until registration ends. Operator first: new registration must wait for the committed CLOSED or revoked grant and then deny it. A successful precondition verifies the latter is not a blanket deny. Both scripts check zero persisted synthetic workspace/audit rows and an authorized test-only local PostgreSQL target.
- The latest source also includes a disposable PostgreSQL **fail-closed rollback rehearsal**: the exact original `0059` function is restored only AFTER revoking `PUBLIC`/`anon`/`authenticated` EXECUTE, and the test verifies authenticated callers cannot register after rollback. Restoring the original unguarded function with its original authenticated EXECUTE permission would reopen the vulnerability and is prohibited without a separately approved replacement control.
- The latest guarded source adds a **READ ONLY, immediately-after-install CLOSED-mode attestation** (`docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql`), intended to run after a separately approved migration and **before** any owner fixture or QA grants. It requires exactly one CLOSED singleton, zero registration grants, no client access to private schema/tables or PUBLIC RPC, expected privileged owners, table RLS and exact approved guarded function body hash `b24154db78c5f1b210f86c97f896d44d`. Twenty disposable PG17 negative cases, including comment-only function drift, MUST block. This check will deliberately fail after approved QA grants; it is an **installation receipt**, not a general health monitor.
- Database SQL remains a **candidate in docs/engineering/security, not an executable migration**. Default `CLOSED` mode and opt-in expiring QA_ONLY grants are source behavior only; `PUBLIC` is a hypothetical independently gated future mode. PG17 synthetic users are disposable CI fixtures, not Supabase real signed-in owner sessions.
- The preinstallation SQL gate is READ-ONLY. The canonical registration and repaired branch functions are fingerprint-checked, along with SECURITY DEFINER mode, **exact postgres ownership for both privileged functions**, anonymous denial, Data API role CREATE denial and absence of the protected schema. Disposable PG17 negative tests change each function owner independently and require an error before restoring the preimage. This must be **rerun immediately before** separately approved SQL installation and must abort on changed baselines.
- Source evidence is **not** a production security mitigation, merchant workflow receipt, provider delivery, source merge authorization or staging/production deploy receipt.

## Real saved Production blocker (last independently observed 2026-10-26)

The connected ServiceDesk main project had **1 confirmed non-anonymous Auth user**, 1 ACTIVE OWNER user, 1 OWNER workspace, 1 active default branch, and the database registration guard schema **absent**. Existing owner-registration SECURITY DEFINER RPC is executable by `authenticated`, anonymous EXECUTE denied. Real P02 #818 has **2/7** acceptance boxes checked and five open, so **NO LIVE TWO-OWNER ACCEPTANCE**.

Migration ledger: verified `0065` default-branch authority repair installed, and source `0063/0064` uninstalled. Releasing the SQL requires explicit DBA approval of an exact migration plan and ledger order, protected function/ACL preimage and rollback, not an indiscriminate `db push`.

## Production selection rule — no double merge

There are **mutually exclusive source options**. Production can evaluate the original individual PRs #868, #869 and #875 with their own rebased tests, or the joint IR15 draft as one alternative. Never merge the original drafts AND their combined rehearsal, and do not merge a draft based solely on this decision memo. Before selecting any option, verify latest canonical branch, source PR heads, audit hashes and exact-merge-head tests; original drafts remain open while Production decides.

## Authority veto and NEXT_TASK

**P02 #818 remains OPEN.** No main Supabase table/auth/config/RPC write, account creation, JWT or password collection, provider message, customer or finance mutation, migration, `samvr`/`samai` access, Vercel project creation, Render hosting switch or release promotion is authorized by source CI. **Vercel deployment not authorized**: it requires separately explicit project, SHA, environment and cost approval; source `vercel.json` preserves `git.deploymentEnabled=false`.

**NEXT_TASK Production:**
1. Independent DBA/security review of exact install candidate #869, current SQL/ACL/RLS/function preimage, migration 0065 order and rollback.
2. Obtain explicit, narrowly scoped owner approval for exact reviewed guard migration on main, apply via supported audited migration mechanism, verify default `CLOSED` and permissions with read-only post-check. Do not do this from Feature Chat.
3. Obtain **separate** approval to provision/identify a second fictional verified QA OWNER, independent workspace/default branch, **and one saved test request in EACH workspace (2 distinct request IDs)**; secure mailbox, record IDs and credentials outside GitHub.
4. Execute real approved two-owner signed-in browser + JWT and RLS negative-tenant source probes using sanitized receipts. Only then check P02 boxes genuinely proven.
5. Decide source integration strategy and exact-current CI; separately approve any hosting/deployment/paid provider actions.

**NO LIVE AUTOMATION CREDIT:** #173 automation backlog is not activated by this rehearsal.

## P18 independent ACL-completeness improvement (27 October 2026)

Source-only exact bytes imported from guarded PR #869 fc474aedb0c4c98f85e9878fb0fd8cc8582f22cf. The postinstall receipt now checks all eight PostgreSQL 17 table privileges across the two protected tables and both API roles, including MAINTAIN. It also checks four column-level privileges. Three additional disposable PG17 negative cases prove authenticated table DELETE, anonymous table MAINTAIN and anonymous column SELECT(mode) drift are each blocked. Strict restored baseline PASS remains mandatory. No live SQL, QA fixture, deployment or canonical merge authorization is implied.

## P18 protected-constraint completeness (source-only, 27 October 2026)

The guarded #869 source at fc474aedb0c4c98f85e9878fb0fd8cc8582f22cf verifies two primary keys, singleton and mode CHECK constraints, the Auth user FK with cascading deletion, and required NOT NULL columns, in addition to comprehensive table/column ACL inspection. PG17 now covers twelve independent negative cases, including dropping the mode CHECK while the data still reads CLOSED, and requires a restored final PASS. The 25 exact #868/#869/#875 source blobs remain locked. No live migration, fixture or deployment authority is implied.

## P19 exact-source refresh — 2026-10-27

Draft #869 adds strict `mode='CLOSED'` and `singleton=true` default checks, plus exact function-level `search_path` with no unreviewed GUCs. Its disposable PG17 negative matrix now includes `MODE_DEFAULT_PUBLIC`, `SINGLETON_DEFAULT_DROPPED`, and `EXTRA_FUNCTION_GUC` (15 cases plus restored final PASS). This composite imports the five updated #869 source blobs, updates the existing 25-file immutable manifest, and preserves exact #868 and #875 bytes. Source-only: no main Supabase migration, QA user/fixture, real JWT/browser acceptance or deployment.

## P20 checked source receipt — 2026-10-27

The guarded draft [#869](https://github.com/SaamVR/ServiceDesk/pull/869) at `b6fabee30d823e56356c1c40eb59bf404c857dbf` retains **all 13 original guard source files** and tightens the read-only installation attestation further. The previous PostgreSQL CHECK-mode source test accepted constraint definitions containing the words CLOSED/QA_ONLY/PUBLIC, even if a semantic `OR TRUE` weakened them. The revised contract matches the exact PostgreSQL 17 CHECK definition, requires validated constraints and exact foreign-key cascade definition, and rejects altered private schema/table owners, added user-defined triggers and rewrite rules. Five additional disposable PG17 negative cases require nonzero BLOCK with final restored PASS, now **20** total. All five changed #869 source objects are imported byte-exact with the 25-object provenance manifest; #868 and #875 source bytes are untouched. The PostgreSQL result is a disposable CI receipt **only**, not installed guard or genuine owner acceptance.

P02 remains **2/7 complete, five unchecked**. Separate DBA security review and explicit owner approval are still required for exact SQL installation/rollback in CLOSED mode; QA identities/tenant fixtures, real signed-in UAT and any Vercel deployments have independent approval boundaries. Do not merge the source composites and originals together.
