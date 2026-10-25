> **2026-10-26 VERIFIED UPDATE (supersedes all older NOT APPLIED/through-0062 statements below):** The owner-approved 0065-only `servicedesk_default_branch(uuid)` security fix was successfully installed through the connected Supabase `apply_migration` on existing main project `cpmmgivhlkfbiwzhlcey`. Ledger now has 70 entries; latest `20261025200147 sd_0065_v4_default_branch_membership_authority`. Installed function MD5 `9f14160f16e16ffe6ac16f35c3f4557f`, active membership guard and authenticated-only EXECUTE verified. In READ-ONLY synthetic role-context probes, existing real owner's account may resolve its own default branch, unrelated authenticated nonmember receives NULL and sees zero workspace/branch rows. Existing 1 auth user, 1 workspace, 1 request unchanged; no new accounts, messages, or migrations 0063/0064. The approved 0065 **out-of-sequence** exception must be reconciled before any subsequent migration push; never modify or reapply applied migration blindly. **Real two-distinct-owner JWT/browser acceptance and existing Render V4 deployment remain unverified; P02 stays open.** [GitHub P02 live checkpoint](https://github.com/SaamVR/ServiceDesk/issues/818).

# P02 authorized MAIN Supabase default-branch security repair — execution handoff

**Date:** 25 October 2026 · **Owner approved:** early security-only membership authorization fix on existing main Supabase. **Status:** NOT APPLIED, because connected write action was blocked by a safety gate. This document is an operational runbook and does not pretend the migration executed.

## Scope and immutable reference

- **Target project**: `ServiceDesk` / `cpmmgivhlkfbiwzhlcey` / PostgreSQL 17, currently migration 0062.
- **Exact already-reviewed SQL source**: [`supabase/migrations/0065_v4_default_branch_membership_authority.sql`](https://github.com/SaamVR/ServiceDesk/blob/8ed57739bedf924c3b7554eb702bd28d7520d63c/supabase/migrations/0065_v4_default_branch_membership_authority.sql).
- **Verified source SHA256** (read back from clean canonical Git checkout): `f4f6ac434c94cfe1543b0fa4c8f1ccd6cd7f832d53cedb02d9db26f3e27866fe`.
- **Git blob SHA**: `a1d1097c1c31ae258ec4151b7d208bb3c415c21a`.
- **ONLY DDL**: exactly 1 `CREATE OR REPLACE FUNCTION public.servicedesk_default_branch(uuid)`, 1 `REVOKE ALL FROM PUBLIC, anon`, and 1 `GRANT EXECUTE TO authenticated, service_role`. No new tables, deletions, triggers, customer rows, 0063/0064, paid provider operations, or Render actions.
- **Required result**: signed-in users can resolve default branch only for a workspace in which they have an ACTIVE membership. `anon` has no EXECUTE; existing authorized trigger/RPC operations remain functional.
- **Preimage**: [PRIVATE recovery vault](https://github.com/SaamVR/ServiceDesk-Recovery-Vault/blob/main/snapshots/servicedesk-p02-default-branch-live-preimage-20261025.sql), previously read back and verified; current installed function MD5 `ba7dd7890bbd1da8597eabdee656b0a3`. The preimage contains known-insecure authorization logic: **do not automatically roll back to it**, as that would reopen the vulnerability.

## Preflight receipts

- Latest observed primary project remains healthy. Installed migration ledger ends at `sd_0062_v4_branch_trigger_rowtype_guard`; no 0063–0065 present.
- Current function MD5 matched the private backup before attempted migration.
- Disposable PostgreSQL 17 source workflow applies 0065 independently of 0063/64 in its fixture, then tests owner A/B, foreign denial and seven-table trigger behavior. This is **not** evidence the fix was applied to MAIN.
- Actual MAIN read-only negative test before fix: fake authenticated non-member saw zero `workspaces` RLS rows yet resolved a foreign default-branch ID. This proves branch-ID disclosure, not full customer table access.
- Owner authorized this exact limited fix. No user authorization exists for 0063, 0064, public signup, live sending or Render deployment.

## Tool failure and recovery boundary

The connected `apply_migration` operation did not execute: safety checks blocked the attempted change. A separate read-only inspection **after the block** confirmed `schema_migrations` still through 0062 and the original function MD5 remains `ba7dd7890bbd1da8597eabdee656b0a3`.

**Do not retry through alternative privileged remote shells, global credentials, or service-role access to circumvent this safety boundary.** A project operator should complete this approval-scoped security migration through their supported authenticated Supabase migration UI/CLI workflow, with an explicit change review, or reauthorize a supported connected migration action when it is permitted. See official [Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations) and [Supabase migration API](https://supabase.com/docs/reference/api/v1-apply-a-migration).

## Required operator execution and safe verification

1. Select **only** Supabase project `cpmmgivhlkfbiwzhlcey`. Review the private preimage backup and rollback contingency before executing.
2. Apply **only** the entire 0065 source SQL through a *tracked migration* named `sd_0065_v4_default_branch_membership_authority` (or a one-time specifically logged security-hotfix migration whose recorded SQL is byte-identical). Do **not** run the 0063 and 0064 quote/pricing migrations. Running untracked ad hoc SQL without recording migration history risks drift.
3. Because 0065 is intentionally applied ahead of 0063/64, mark a **documented migration-order exception**. Before future automated `db push` or resets, reconcile filename/migration ledger ordering; do not replay 0065 as an unrelated schema patch.
4. Immediately read back the installed function body, ACL and migration ledger; verify membership predicate (`m.workspace_id = target_workspace`, `m.user_id = auth.uid()`, `m.status='ACTIVE'`), empty search path, no `anon` execute and authenticated execute.
5. Run real read-only role-context checks: a non-member must see no workspace rows and `servicedesk_default_branch(known_foreign_workspace)` must return `NULL`; an authorized active owner must still resolve their own default branch. Include inactive/revoked members and service-role trigger compatibility before accepting.
6. Compare existing data counts and RLS policies before/after, and review the project's security advisers. Never print actual workspace IDs, user emails or credentials in issue comments.
7. Keep `SERVICEDESK_OWNER_REGISTRATION_ENABLED=false` and `SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED` unset on Render until two controlled owner accounts have passed real authenticated onboarding and denial tests.
8. If legitimate operations break, immediately disable QA/public signup and pause affected workflows, investigate the vetted source/release logs, and get an explicit incident rollback decision. **Restoring the vulnerable preimage is not a default fix.**

## Follow-up probes after external migration

Read-only database inventory:
```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc limit 5;

select
  md5(pg_get_functiondef('public.servicedesk_default_branch(uuid)'::regprocedure)) as function_md5,
  (position('m.user_id = auth.uid()' in
     pg_get_functiondef('public.servicedesk_default_branch(uuid)'::regprocedure)) > 0) as membership_guard_present,
  has_function_privilege('anon', 'public.servicedesk_default_branch(uuid)', 'EXECUTE') as anonymous_execute,
  has_function_privilege('authenticated', 'public.servicedesk_default_branch(uuid)', 'EXECUTE') as authenticated_execute;
```

This SQL only checks metadata. **True tenant denial still needs tests under separate authenticated owner/non-member role contexts**, not admin-service client reads.

## Program status

[P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818) remains open and [owner-input register #829](https://github.com/SaamVR/ServiceDesk/issues/829) retains the approved scope and recorded provider block. [P02 source SHA](https://github.com/SaamVR/ServiceDesk/commit/8ed57739bedf924c3b7554eb702bd28d7520d63c) is source/CI verified (3,713 tests), but cannot be declared STAGING_VERIFIED or PRODUCTION_READY until the actual database and Render checkpoints pass.
