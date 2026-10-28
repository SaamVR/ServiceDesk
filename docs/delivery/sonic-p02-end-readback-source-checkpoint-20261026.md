# P02 source safety checkpoint — final saved-authority readbacks

**Track:** isolated Feature Chat/source-only hardening · [#867](https://github.com/SaamVR/ServiceDesk/issues/867) · blocking Production acceptance [#818](https://github.com/SaamVR/ServiceDesk/issues/818) · delivery control [#808](https://github.com/SaamVR/ServiceDesk/issues/808).

**Canonical at assignment:** `cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411`. This source-only draft neither creates a staging environment nor grants authority to merge/deploy.

## What was proven via live, READ ONLY Supabase metadata

Connected main ServiceDesk project `cpmmgivhlkfbiwzhlcey`. One aggregate, no-ID SQL result on 2026-10-26:

| Real saved data signal | Count |
| --- | ---: |
| Distinct `ACTIVE` `OWNER` membership subjects | **1** |
| Distinct workspaces with an `ACTIVE` `OWNER` membership | **1** |
| Total current workspace rows | **1** |
| Total active default branches | **1** |
| Total active owner membership rows | **1** |

These aggregates do not prove a fresh authenticated browser session. They **do prove** there are not currently two independently saved eligible owner/workspace identities. **BLOCKED_OWNER_AUTHORIZATION**: second fictional QA owner and isolated workspace creation/provisioning, actual authenticated browser access and writable QA setup require separate Production owner permission. **NO LIVE TWO-OWNER ACCEPTANCE**. P02 #818 remains **2/7 mandatory items checked**.

## Concrete P02 code delta, with no database change

The existing 20-request real-JWT read-only owner acceptance script checks both owner identities and workspaces, own/foreign RLS rows, saved default branches, and known read-only `servicedesk_default_branch` RPC. An external membership change could happen during that matrix. This source hardening defers two final saved GET readbacks per owner **until both owners' entire matrix checks have finished**: active owner membership with original verified JWT subject, and active default branch whose identity must match the initially validated saved branch. JWT expiration is rechecked after both owners' last network read. A changed, revoked, duplicate or missing membership/default causes a denial; an expired JWT at the end also denies. It now issues 24 authorized read operations total (20 GET and 4 known read-only RPC POST), with no new table or network origin.

This reduces stale-proof/TOCTOU risk but **is not an atomic snapshot, an active token-revocation proof, or proof that the owner remains authorized after completion**. Tests use offline fictional JWTs and mock requests; no real accounts or provider credentials are included. Existing 2-owner tests are updated; a separate adversarial suite injects mid-audit membership revocation/demotion (including revocation of OWNER-A while OWNER-B is being audited), default-branch replacement/removal and in-flight JWT expiry. Independent critic tests verify request scope, no new write operation, negative-case detection and no false LIVE claim.

## Other advisory observations (read only, no fixes authorized)

Supabase security advisors report five `authenticated`-executable SECURITY DEFINER functions, one `citext` extension in public, four RLS-enabled public tables without policies and leaked-password protection disabled. These are advisor flags, **not individually proven exploitability**; several functions might intentionally require signed-in execution. Review body/GRANT/RLS and app-level callers in Production's security lane. Do not revoke grants, migrate extensions, enable paid settings, or change Auth policy based solely on a warning without separate impact review and approval. References: [Supabase SECURITY DEFINER warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [public extension warning](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [RLS/no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Five independently owned source/critic lanes

1. Server read-only final-authority recheck: `scripts/release/v4-p02-two-owner-readonly-acceptance.mjs`
2. Regression expectations: two existing `scripts/release/tests/v4-p02-two-owner-*.test.mjs` files
3. Adversarial revocation: new `scripts/release/tests/v4-p02-mid-audit-authority-revocation.test.mjs`
4. Independent source critic: `tests/ai/sonic-p02-end-authority-readback-critic.test.ts`
5. Governance/Production handoff: this document

Coordinator combines disjoint source ownership into an **OPEN DRAFT PR** against latest observed canonical; original IR14/feature source PRs remain separate and untouched.

## Release and next-action boundary

- P02 Production must get distinct **real** OWNER-A/B accounts/workspaces and authenticated sessions using approved test identity/fixture policy, validate registration/login/recovery and cross-tenant negative paths, then collect sanitized server-side result artifacts and real browser receipts.
- No JWT, password, secret, private person/tenant ID or email should be included in GitHub comments or CI logs.
- No provider message, AI billing, financial mutation, SQL write/migration, shared database QA fixture, Vercel project creation, manual/auto preview/staging/production deploy, or changes to `samvr`/`samai` were performed. **NO DEPLOYMENT** without new explicit project/SHA/environment approval.
- This is only a source safety improvement. Never count these tests as a second real owner or close P02 just because full TypeScript/tests/lint/build pass.

**NEXT TASK:** Production #818 — seek separately scoped authorization and securely provision/identify second QA owner/workspace, then conduct real two-token read-only audit and signed-in browser UAT; only Production may decide IR14/source integration after current-canonical QA. Until credentials and approval exist, mark that action `BLOCKED_OWNER_AUTHORIZATION`, not DONE.

## Required known saved request witnesses for genuine cross-tenant request proof

Previously the probe returned PASS when BOTH owner's saved request tables were empty; a negative read of a nonexistent foreign row is not meaningful evidence of request-level RLS isolation. The updated read-only probe requires separate known fictional saved request IDs (SD_P02_OWNER_A_REQUEST_ID / SD_P02_OWNER_B_REQUEST_ID) and verifies that each record exists in its owner's workspace under its owner's real JWT, while querying that identical known record with the other owner's JWT must return no rows. Missing, duplicate or mismatched request receipts fail closed. This does not create or mutate any record. Creating two isolated fictional requests requires separate explicit owner-approved QA data authorization. Protected mutating-command denial and signed-in browser journeys remain independent P02 gates.
