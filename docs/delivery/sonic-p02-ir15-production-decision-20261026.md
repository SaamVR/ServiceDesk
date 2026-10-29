# P02 IR15 — Joint owner-readback + registration-guard source rehearsal
**SOURCE-ONLY DRAFT / UNMERGED. SQL NOT INSTALLED. NO LIVE TWO-OWNER ACCEPTANCE.**

Control: [#870](https://github.com/SaamVR/ServiceDesk/issues/870), main Production blocker [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818), delivery master [#808](https://github.com/SaamVR/ServiceDesk/issues/808).

## Scope and provenance (exact code, no reimplementation)

| Isolated source owner | Original draft | Pinned source head | Imported Git blobs |
| --- | --- | --- | ---: |
| Post-session owner authority proof | [#868](https://github.com/SaamVR/ServiceDesk/pull/868) | `d9c53c05cf5f98bf9e5fec688e2f56cc3e42b360` | 7 |
| Database registration authorization candidate | [#869](https://github.com/SaamVR/ServiceDesk/pull/869) | `053bf3493d6f38e29000e06d5a3868a24442205a` | 17 |
| Registration authorization UX and trusted error source | [#875](https://github.com/SaamVR/ServiceDesk/pull/875) | `b0aaf768efd01dada9de6adaec4484024e01267a` | 5 |

Combined rehearsal pinned over canonical `cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411`. **29 source paths, no pathname collision**: 24 additions and five modified existing source/test paths. `docs/delivery/sonic-p02-ir15-exact-source-lock-20261026.json` stores PR and Git blob object SHAs. Automated source-lock unit test rehashes **all 29 exact imported Git blob objects**; an independent release critic and this runbook are the only new integration-specific artifacts. None of the original source code bytes were altered or replaced.

## P24 authenticated owner security hardening (2026-10-29)

Updated source #868 checks that JWT audience is exactly authenticated
(string or single-member array), rejects anonymous claims, and rechecks
the returned Supabase Auth user's role, audience, active ban and verified
identity. Focused offline tests and source critic cover negative cases.
No live user/session was created; no database or deployment was changed.

## Foreign owner-membership witness corrected (2026-10-29)

Source PR #868 now probes the known foreign OWNER subject on the foreign workspace,
instead of the auditor's own subject. The previous filter could return an empty
membership response even when another OWNER's row was improperly readable.
Adversarial offline tests now simulate that exact foreign membership exposure,
while other foreign resource reads remain correctly denied; PASS is rejected.
The correction changes only read-only query selection/verification and local tests,
not any provider, database migration, Auth fixture, or deployment. Exact-source
provenance remains pinned in the 29-file manifest and requires fresh exact-head CI.

## P25 registration RPC receipt and browser validation hardening (2026-10-29)

The real existing registration RPC returns `{ok:true,slug,existing:boolean}` on
successful owner creation or idempotent owner lookup. The original client
accepted an incomplete `{ok:true,slug}` and contradictory success/error
responses. Source PR #875 now requires a boolean `existing` field, no error
code on successful responses, and a valid slug; malformed receipts never
redirect to onboarding. The HTML workspace-slug field now disallows double
or trailing hyphens, with 3–40 character bounds matching the server.
Focused mock action and browser/server-parity tests cover these cases.
This is source-only: it does not claim production DB remediation, a new
real OWNER session, or deployment.

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

The guarded #869 source at fc474aedb0c4c98f85e9878fb0fd8cc8582f22cf verifies two primary keys, singleton and mode CHECK constraints, the Auth user FK with cascading deletion, and required NOT NULL columns, in addition to comprehensive table/column ACL inspection. PG17 now covers twelve independent negative cases, including dropping the mode CHECK while the data still reads CLOSED, and requires a restored final PASS. At that P18 checkpoint, 25 exact #868/#869/#875 source blobs remained locked; the current P21 manifest contains 28. No live migration, fixture or deployment authority is implied.

## P19 exact-source refresh — 2026-10-27

Draft #869 adds strict `mode='CLOSED'` and `singleton=true` default checks, plus exact function-level `search_path` with no unreviewed GUCs. Its disposable PG17 negative matrix now includes `MODE_DEFAULT_PUBLIC`, `SINGLETON_DEFAULT_DROPPED`, and `EXTRA_FUNCTION_GUC` (15 cases plus restored final PASS). This composite imports the five updated #869 source blobs, updated the then-25-file immutable manifest (now 28 source objects at P21), and preserves exact #868 and #875 bytes. Source-only: no main Supabase migration, QA user/fixture, real JWT/browser acceptance or deployment.

## P20 checked source receipt — 2026-10-27

The guarded draft [#869](https://github.com/SaamVR/ServiceDesk/pull/869) at `b6fabee30d823e56356c1c40eb59bf404c857dbf` retains **all 13 original guard source files** and tightens the read-only installation attestation further. The previous PostgreSQL CHECK-mode source test accepted constraint definitions containing the words CLOSED/QA_ONLY/PUBLIC, even if a semantic `OR TRUE` weakened them. The revised contract matches the exact PostgreSQL 17 CHECK definition, requires validated constraints and exact foreign-key cascade definition, and rejects altered private schema/table owners, added user-defined triggers and rewrite rules. Five additional disposable PG17 negative cases require nonzero BLOCK with final restored PASS, now **20** total. All five changed #869 source objects are imported byte-exact with the then-25-object provenance manifest (now 28 at P21); #868 and #875 source bytes are untouched. The PostgreSQL result is a disposable CI receipt **only**, not installed guard or genuine owner acceptance.

P02 remains **2/7 complete, five unchecked**. Separate DBA security review and explicit owner approval are still required for exact SQL installation/rollback in CLOSED mode; QA identities/tenant fixtures, real signed-in UAT and any Vercel deployments have independent approval boundaries. Do not merge the source composites and originals together.

## P21 exact ledger reconciliation — source-only, 2026-10-27

Imported 3 new guard-PR paths byte-for-byte into composite #871 from [#869](https://github.com/SaamVR/ServiceDesk/pull/869) at `053bf3493d6f38e29000e06d5a3868a24442205a`: `docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql`, `tests/sql/p02-registration-migration-ledger-disposable-setup-pg17.sql`, and `scripts/release/tests/v4-p02-migration-ledger-negative-pg17.sh`. Existing workflow, focused source critic and DBA handoff were imported byte-exact. Together this produces **28 source objects**: 7 from #868, 16 from #869, 5 from #875, verified against the Git blob-lock manifest. Only composite QA/provenance/runbook files differ from the isolated originals.

Main database's **read-only ledger** still has 70 entries, including exact 0062 (`20261012105723`) and **out-of-order 0065** (`20261025200147`), but no 0063/0064. The new second pre-install gate blocks a missing/relabelled 0062/0065, recorded 0063/0064, or duplicate 0065 identity. Nine disposable PG17 adversarial cases verify actual denial, then restored positive. The first pre-install gate's ten live source/ownership/ACL invariants also passed in read-only observation. Neither gate installs SQL nor grants accounts.

**Stop/approval boundaries unchanged:** P02 remains 2/7. Owner and DBA must separately authorize an exact SQL installation/backup/rollback plan; later independently authorize QA Auth B/workspace/request and real independent signed-in JWT/browser RLS acceptance; separate permission for any Vercel deployment. No merge of draft originals alongside this composite.

P21 final suffix-safety amendment: source gate blocks any `sd_0063*`/`sd_0064*` ledger entry, including PostgreSQL fixture cases `sd_0063a_unreviewed` and `sd_0064a_unreviewed`. Nine labelled negative cases and restored read-only PASS must pass in separate PG17 Actions, not against live Supabase.

## P22 source-only lifecycle rehearsal — 2026-10-28

The guarded draft [#869](https://github.com/SaamVR/ServiceDesk/pull/869) at `053bf3493d6f38e29000e06d5a3868a24442205a` adds one reviewed disposable PostgreSQL 17 fixture and updates four pre-existing guard-source files, leaving the guarded candidate SQL **unchanged and uninstalled**. The composite imports those exact five source objects. Its locked source provenance now contains **29 files: 7 #868 + 17 #869 + 5 #875**; the #868 and #875 original source hashes are still unchanged.

**Release lifecycle on one synthetic database** `servicedesk_p02_registration_rollback`:
- Verify exact 0059 registration preimage and repaired 0065 branch preimage.
- Create a synthetic 0062/0065 migration ledger and require the existing **read-only** migration ledger receipt before the guard install.
- Install the existing source guard with singleton mode `CLOSED`; require the complete post-install `P02_REGISTRATION_POSTINSTALL_CLOSED_PASS` on **the same database**.
- Revoke authenticated EXECUTE before restoring the original 0059 function, then remove only the synthetic security schema; require actual authenticated-role function denial and no new unauthorized workspace.
- Require an **unchanged 0062/0065 migration ledger receipt again after rollback**.

This is a **disposable rehearsal only**: it does **not** prove live Supabase backup/restore, apply a migration or authorize a production rollback, create a second QA user, test real JWT/browser isolation, or deploy to Vercel. The real live DBA must choose a separately approved backup/restore procedure, and must **never execute the disposable rollback fixture against production**. Keep the issue #818 P02 acceptance tally at 2/7 with all five production gates open.

## P23 Auth-server identity attestation (SOURCE-ONLY, 2026-10-29)

[Owner readback draft #868](https://github.com/SaamVR/ServiceDesk/pull/868) at `d9c53c05cf5f98bf9e5fec688e2f56cc3e42b360` now additionally performs authenticated `GET /auth/v1/user` for **both** intended owners before any row-level-security table queries and again **after** the complete dual-owner tenant matrix. The API host is fixed to the intended Supabase project; only a publishable key and each owner's own JWT are supplied. Auth server responses must match the decoded JWT subject, show a confirmed email, and not mark a user anonymous. HTTP/Auth failures, mismatches, unconfirmed/anonymous owner users, or identity changes during the audit must veto a positive receipt. No Auth response bodies, user IDs, email addresses, JWTs or API keys are added to CLI output.

Source-only mocks include intentional bad identity responses and offline fake JWTs; passing GitHub CI **does not validate real signed-in sessions**. Future live UAT must supply independently obtained real owner JWTs and read-only approval, and the active registration guard must be installed/attested separately before owner B is provisioned. This Auth GET verifies the server-side user record, but the overall matrix remains non-atomic, and is NOT a substitute for signed-in browser workflow or real JWT/RLS negative-path acceptance.

The composite still locks **29 exact source files**. Its original guard SQL and migration controls are untouched, and all approvals for live Supabase mutation, QA fixtures, PR merge, deployment or Vercel remain unchanged.

## P24 Auth-owner audience and ban status — source-only verification (2026-10-29)

Source draft #868 at `d9c53c05cf5f98bf9e5fec688e2f56cc3e42b360` adds two independent JWT/identity checks to the read-only, two-owner acceptance runner: the decoded JWT must have the singleton `authenticated` audience (string or singleton array) and cannot claim anonymous sign-in; both Auth-server `GET /auth/v1/user` profiles must also show role and audience `authenticated`, confirmed email, matching user ID, and no active/malformed `banned_until`. A past ban is accepted. The offline negative suite covers wrong/multi-audience token, anonymous token, wrong Auth role/audience and active/malformed bans. The P24 independent critic enforces these checks without adding network credentials or deployment rights.

These are source and mock receipts only. They do not prove the existing Supabase project has a second real signed-in owner or that Auth session revocation is instantaneous. No actual user, workspace, data, migration, backup, Vercel/Render deployment, or canonical/main mutation was performed. P02 remains 2/7 until separately owner-authorized CLOSED registration guard installation and real independently authenticated cross-tenant UAT, with a verified live rollback plan.
