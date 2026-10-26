# P02 IR15 — Joint owner-readback + registration-guard source rehearsal
**SOURCE-ONLY DRAFT / UNMERGED. SQL NOT INSTALLED. NO LIVE TWO-OWNER ACCEPTANCE.**

Control: [#870](https://github.com/SaamVR/ServiceDesk/issues/870), main Production blocker [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818), delivery master [#808](https://github.com/SaamVR/ServiceDesk/issues/808).

## Scope and provenance (exact code, no reimplementation)

| Isolated source owner | Original draft | Pinned source head | Imported Git blobs |
| --- | --- | --- | ---: |
| Post-session owner authority proof | [#868](https://github.com/SaamVR/ServiceDesk/pull/868) | `9df47e173e181cae6345a81f5baf19c2d79a6e1c` | 7 |
| Database registration authorization candidate | [#869](https://github.com/SaamVR/ServiceDesk/pull/869) | `e46735ae9f4385cb8521b1d2c22665c800e5815c` | 7 |

Combined rehearsal pinned over canonical `cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411`. 14 source paths, **no pathname collision**. Eleven added paths, three intentionally modified existing source/test paths. `docs/delivery/sonic-p02-ir15-exact-source-lock-20261026.json` stores PR and Git blob object SHAs. Automated source-lock unit test rehashes **all 14 exact bytes** (Git object format); an independent release critic and this runbook are the only new integration-specific artifacts. None of the original source code bytes were altered or replaced.

## What combined source CI can and cannot establish

- With both drafts in one tree, execute full Next.js/TypeScript/ESLint source RC, the actual off-line two-owner readback Node integration suite, disposable PostgreSQL 17 role-switch/registration + preflight-negative suite, current merge-tree parity and independent critic integrity, at ONE exact HEAD. All checks must pass and source manifests must remain immutable.
- Readback script requires two **distinct preapproved saved request IDs**, one existing readable request record per owner/tenant. It proves each owner reads its own saved row and cannot read the other's. It retains pinned project GET or known read-only-RPC POST calls, final saved membership/default-branch authority checks AFTER complete A+B audit, and JWT-expiry denial; it does not prove server-side revocation of every in-flight JWT, atomic database snapshots, or the presence of a second real signed-in OWNER.
- Database SQL remains a **candidate in docs/engineering/security, not an executable migration**. Default `CLOSED` mode and opt-in expiring QA_ONLY grants are source behavior only; `PUBLIC` is a hypothetical independently gated future mode. PG17 synthetic users are disposable CI fixtures, not Supabase real signed-in owner sessions.
- The preinstallation SQL gate is READ-ONLY. The canonical registration and repaired branch functions are fingerprint-checked, along with SECURITY DEFINER mode, anonymous denial, Data API role CREATE denial and absence of the protected schema. This must be **rerun immediately before** separately approved SQL installation and must abort on changed baselines.
- Source evidence is **not** a production security mitigation, merchant workflow receipt, provider delivery, source merge authorization or staging/production deploy receipt.

## Real saved Production blocker (last independently observed 2026-10-26)

The connected ServiceDesk main project had **1 confirmed non-anonymous Auth user**, 1 ACTIVE OWNER user, 1 OWNER workspace, 1 active default branch, and the database registration guard schema **absent**. Existing owner-registration SECURITY DEFINER RPC is executable by `authenticated`, anonymous EXECUTE denied. Real P02 #818 has **2/7** acceptance boxes checked and five open, so **NO LIVE TWO-OWNER ACCEPTANCE**.

Migration ledger: verified `0065` default-branch authority repair installed, and source `0063/0064` uninstalled. Releasing the SQL requires explicit DBA approval of an exact migration plan and ledger order, protected function/ACL preimage and rollback, not an indiscriminate `db push`.

## Production selection rule — no double merge

There are two **mutually exclusive source options**. Production can evaluate the original individual PRs #868 and #869 with their own rebased tests, or the joint IR15 draft as one alternative. Never merge both original drafts AND their combined rehearsal, and do not merge a draft based solely on this decision memo. Before selecting any option, verify latest canonical branch, source PR heads, audit hashes and exact-merge-head tests; original drafts remain open while Production decides.

## Authority veto and NEXT_TASK

**P02 #818 remains OPEN.** No main Supabase table/auth/config/RPC write, account creation, JWT or password collection, provider message, customer or finance mutation, migration, `samvr`/`samai` access, Vercel project creation, Render hosting switch or release promotion is authorized by source CI. **Vercel deployment not authorized**: it requires separately explicit project, SHA, environment and cost approval; source `vercel.json` preserves `git.deploymentEnabled=false`.

**NEXT_TASK Production:**
1. Independent DBA/security review of exact install candidate #869, current SQL/ACL/RLS/function preimage, migration 0065 order and rollback.
2. Obtain explicit, narrowly scoped owner approval for exact reviewed guard migration on main, apply via supported audited migration mechanism, verify default `CLOSED` and permissions with read-only post-check. Do not do this from Feature Chat.
3. Obtain **separate** approval to provision/identify a second fictional verified QA OWNER, independent workspace/default branch, **and one saved test request in EACH workspace (2 distinct request IDs)**; secure mailbox, record IDs and credentials outside GitHub.
4. Execute real approved two-owner signed-in browser + JWT and RLS negative-tenant source probes using sanitized receipts. Only then check P02 boxes genuinely proven.
5. Decide source integration strategy and exact-current CI; separately approve any hosting/deployment/paid provider actions.

**NO LIVE AUTOMATION CREDIT:** #173 automation backlog is not activated by this rehearsal.
