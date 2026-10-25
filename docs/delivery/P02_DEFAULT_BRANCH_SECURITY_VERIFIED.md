# P02 — verified tenant security defect and guarded 0065 emergency remediation

**Date:** 2026-10-25 · **Connected main Supabase:** `cpmmgivhlkfbiwzhlcey` · **Current live migration:** 0062 · **Source canonical:** `8ed57739bedf924c3b7554eb702bd28d7520d63c` (PRs #834/#835 merged, source release CI pending at this writing).

## Latest verified code and recovery checkpoint

- Canonical V4 `8ed57739bedf924c3b7554eb702bd28d7520d63c` has **exact merged-head PASS** in [app / 752 suites / 3,713 tests / Chrome #40172156776](https://github.com/SaamVR/ServiceDesk/actions/runs/40172156776), [PostgreSQL 17 + worker #40172156769](https://github.com/SaamVR/ServiceDesk/actions/runs/40172156769), and [unattended guardian #40172156787](https://github.com/SaamVR/ServiceDesk/actions/runs/40172156787). These CI reports still correctly say authenticated owner, tenant RLS and provider delivery acceptance are **FALSE**.
- **PRIVATE recovery vault backup verified:** [pre-hotfix installed function definition and ACL snapshot](https://github.com/SaamVR/ServiceDesk-Recovery-Vault/blob/main/snapshots/servicedesk-p02-default-branch-live-preimage-20261025.sql), commit `4f809cf248b1899a8618f254602871e4abb683a6`; MD5 `ba7dd7890bbd1da8597eabdee656b0a3`. Contains no tenant UUID, customer data or credentials. **Known-vulnerable preimage: NEVER redeploy without emergency security waiver.**
- Post-probe read-only counts unchanged: **1 confirmed owner user / 1 workspace / 1 default branch / 0 services / 0 price books / 1 request / 0 quotes**. Render still suspended on older V3 branch. No SQL, source activation, paid provider or hosting configuration changes.
- Existing PG17 workflow `v4-seven-table-branch-guard-pg17-rc.yml` already applies 0065 in a disposable fixture **after 0062 and without 0063/0064**, proving the security function's independence at fixture level. A security-only early migration on MAIN still requires a deliberate recorded sequencing exception and separate authorization.

## Controlled proof of real authorization defect — READ ONLY, no customer identifiers recorded

Executed on the actual connected database inside an explicitly `READ ONLY` transaction, with PostgreSQL's `authenticated` role and a **fictional** JWT `sub` that has no membership. The transaction ended with `ROLLBACK`.

| Assertion | Actual database observation |
|---|---|
| Tested Postgres role | `authenticated` |
| Signed-in fictional identity's direct `workspaces` RLS-visible rows | **0** |
| `public.servicedesk_default_branch(<existing workspace UUID>)` returns a non-null result | **TRUE — SECURITY ISSUE** |
| Any write, real user login or provider call made | **NO** |
| Existing owner/customer identifying UUIDs or email exposed in report | **NO** |

This confirms **foreign default-branch UUID disclosure through a SECURITY DEFINER RPC**. It does **not** demonstrate access to customer addresses, arbitrary table reads, payments or writes; those require separate tests and should not be claimed as verified.

Installed function uses `public.workspace_branches` without an authenticated workspace-membership predicate; `authenticated` has EXECUTE, anonymous does not. Relevant official risk: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable .

## Exact already-reviewed remediation available in the repo

- [Source `0065_v4_default_branch_membership_authority.sql`](https://github.com/SaamVR/ServiceDesk/blob/feat/servicedesk-v4-reconciled-qa-shell-20261012/supabase/migrations/0065_v4_default_branch_membership_authority.sql)
- SHA256 of source SQL at verified baseline: `f4f6ac434c94cfe1543b0fa4c8f1ccd6cd7f832d53cedb02d9db26f3e27866fe`.
- Function changes: requires **real active membership** `m.workspace_id=target_workspace AND m.user_id=auth.uid() AND m.status='ACTIVE'` or specifically identified internal service role; search path is set empty, anon/public EXECUTE revoked.
- [Independent source tests](https://github.com/SaamVR/ServiceDesk/blob/feat/servicedesk-v4-reconciled-qa-shell-20261012/tests/db/v4-default-branch-security-migration.test.ts).
- [Disposable PostgreSQL 17 two-owner auth & trigger compatibility workflow](https://github.com/SaamVR/ServiceDesk/blob/feat/servicedesk-v4-reconciled-qa-shell-20261012/.github/workflows/v4-seven-table-branch-guard-pg17-rc.yml) explicitly applies `0065` **after 0062** and before any `0063` or `0064` in its **disposable fixture**. Thus there is a tested early-remediation route **in a fixture**, though main database deployment sequencing/rollback have not yet been accepted.
- No migration 0063, 0064 or 0065 has been applied to live Supabase as of this observation.

## Decision needed before any MAIN database schema write

Normal planned migration release sequence is 0063 → 0064 → 0065, but P02's discovered security vulnerability blocks safely enabling new accounts. We must **not silently bypass the fixed runtime plan** or run out-of-order SQL without a separate approval.

**Recommended controlled security exception:** owner approves an early, *narrow*, migration-ledger-tracked application of the exact reviewed 0065 function/ACL repair on existing main Supabase, with the emergency change recorded as an explicitly named security-hotfix migration and 0065 later treated as idempotent reapplication. This exception must be reconciled with remaining 0063/0064 migration history. Do not apply until an independent release reviewer verifies actual installed object signature/ACL, complete recoverable pre-change function definition, rollback mechanics and available database backup.

### Required release gates
- [ ] Owner **explicitly authorizes main database schema SECURITY HOTFIX ONLY**; not blanket approval for 0063, 0064, customer fixture creation, service changes or deployment.
- [ ] Live read-only preflight reconfirms target project, last migration 0062, currently installed SECURITY DEFINER body and execute roles, and SHA256 of the exact candidate SQL.
- [ ] Prove a recoverable backup/export of the existing function definition and a safe rollback approach; rollback to vulnerable state is emergency-only and cannot coincide with public signup.
- [ ] Independent PG17 source test for synthetic owner A/B and triggers PASS on exact candidate; no source mismatch with checked-in migration.
- [ ] Apply one ledger-tracked migration using the approved Supabase tool, with precise name and SQL; not an arbitrary unrecorded dashboard edit.
- [ ] Repeat *the same* negative cross-tenant probe: 0 direct RLS workspace rows, and default branch RPC must now return **NULL** for foreign identity.
- [ ] Repeat legitimate authorized owner default-branch behavior and relevant authenticated triggers.
- [ ] Verify no existing owner workspace/branch/request/quote data changed unexpectedly.
- [ ] Keep both QA/public signup **DISABLED** until distinct authenticated OWNER-A/OWNER-B browser sessions have passed tenant denial tests and the production owner accepts the rollout.

**No live SQL DDL has been executed, and no customer/test owner account has been created.** [Current P02 issue #818](https://github.com/SaamVR/ServiceDesk/issues/818) stays open. Source-only additional signup gate PR #834 requires `SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED=true` on the server **after** these checks; it does not itself verify the database.

## Existing Render deployment constraint

The only approved ServiceDesk Render target is the suspended `srv-db5p1s142hec739noohg` on old diverged V3 branch. The connected Render plugin cannot change its branch or resume it; changing to V4 requires a separately approved dashboard/browser action with rollback to `3962aa5c84c3aa5f47ad72b62d51ae4382467708`. Do not deploy or claim live V4 until service provider metadata and HTTPS `/health` source SHA match the reviewed commit.
