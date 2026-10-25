# P02 — Shared primary ServiceDesk Supabase + existing Render onboarding preflight

**Scope:** Owner correction 2026-10-25 — **USE EXISTING** Render and ServiceDesk Supabase, not separate staging resources. This report is **read-only evidence and action sequence, NOT staging acceptance**.

## Targets locked by owner
- Supabase: **`cpmmgivhlkfbiwzhlcey`** `ServiceDesk`, PG17, `us-east-1` ACTIVE_HEALTHY. This project contains existing business records; **NO RESET, purge, or cloned schema**.
- Render: **existing** [`servicedesk-v3-frontend-review`](https://dashboard.render.com/web/srv-db5p1s142hec739noohg) (`srv-db5p1s142hec739noohg`), free plan, current lifecycle `suspended`, old release branch `deploy/servicedesk-v3-public-review-20261011`, deploy SHA `3962aa5c84c3aa5f47ad72b62d51ae4382467708`. Do NOT create a new service.
- Desired future V4 candidate: `feat/servicedesk-v4-reconciled-qa-shell-20261012` at `974e9f040071b1a2c1199c7ff6fb652a67812a47`. Existing old Render service is **NOT** that version.
- No service changes, deploys or SQL writes have been made in this P02 inventory.

## Actual connected database aggregates, 2026-10-25

| Table/domain | Actual rows |
|---|---:|
| `auth.users` | **1** |
| confirmed auth users | **1** |
| `workspaces` | **1** |
| active memberships | **1 OWNER** |
| `workspace_branches` | **1** |
| `branch_memberships` | **1** |
| `service_catalog` | **0** |
| `branch_price_books` | **0** |
| `requests` | **1** |
| `quotes` | **0** |

Counts were acquired through read-only SQL; existing emails, workspace names, customer records and access tokens were not retrieved. Public `branches` table does **not** exist: the real branch table is `workspace_branches`.

## AUTH / RLS gate: confirmed missing security fix in installed schema

- The installed `public.servicedesk_default_branch(target_workspace uuid)` is **`SECURITY DEFINER`**, `authenticated` has EXECUTE (anonymous does not), and the currently installed function body only filters `workspace_branches` for matching `workspace_id`, default and active; **it DOES NOT check the caller's workspace membership**. This means a signed-in unrelated user who knows a workspace UUID can obtain its default branch UUID through this RPC. This is **branch-ID information disclosure**, not proof of wider tenant data read/write access.
- **The reviewed corrective migration is already committed in source**: [`0065_v4_default_branch_membership_authority.sql`](https://github.com/SaamVR/ServiceDesk/blob/feat/servicedesk-v4-reconciled-qa-shell-20261012/supabase/migrations/0065_v4_default_branch_membership_authority.sql). SHA-256 `f4f6ac434c94cfe1543b0fa4c8f1ccd6cd7f832d53cedb02d9db26f3e27866fe`. Its query checks `m.workspace_id = target_workspace`, `m.user_id = auth.uid()`, `m.status = 'ACTIVE'`, with limited service-role exception; anonymous EXECUTE is revoked. Reviewed by [source regression test](https://github.com/SaamVR/ServiceDesk/blob/feat/servicedesk-v4-reconciled-qa-shell-20261012/tests/db/v4-default-branch-security-migration.test.ts) and PG17 workflow. **NOT APPLIED TO MAIN SUPABASE**.
- Supabase migration history stops at **0062**, while source has 0063 (transactional quote journal), 0064 (owner pricing revision), 0065 (branch membership security). They have separate change impact. **DO NOT APPLY 0065 OR 0063/64 without explicit migration authorization plus schema backup, SQL checksum and rollback**.
- Main tenant-facing tables `workspaces`, `memberships`, `branch_memberships`, `service_catalog`, `branch_price_books`, `requests` have RLS enabled; this alone is not signed-in cross-tenant acceptance. Need real distinct JWTs for OWNER-A and OWNER-B and actual RLS denial tests.
- Auth security adviser reports leaked-password protection disabled; review before allowing broad public signup: [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Privileged role / additional `SECURITY DEFINER` advisories remain P11 security gate.

**Priority:** do not enable PUBLIC signup, tenant-B account bootstrap or exposure to untrusted users until the default branch disclosure issue is mitigated and tested on this same connected project under explicit migration authority.

## Existing source onboarding paths

- Sign-up server action `src/app/auth/sign-up/actions.ts` uses `@supabase/ssr`, validates form, requires consent, uses verified email redirect and an owner-registration mode.
- `src/features/auth/owner-registration-readiness.ts` supports `DISABLED`, `QA_ONLY`, `PUBLIC`:
  - default DISABLED;
  - `QA_ONLY` requires valid auth configuration, `SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED=true` and `SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS` with 1–10 permitted test inboxes;
  - public mode `SERVICEDESK_OWNER_REGISTRATION_ENABLED=true` should remain OFF until production signup/security acceptance.
- `src/features/auth/verified-owner-workspace.ts` and `authorized-workspace-access.ts` use the authenticated client with membership plus workspace RLS; page entrypoint `/onboarding` and verified owner workspace handoff are present in code.
- Owner workspace RPC `servicedesk_register_owner_workspace` exists in main database; verified read-only body enforces confirmed email, proper actor, membership, unique slug and atomic workspace/member/default-branch creation. No manual ownership bypass should be introduced.

## Single existing Render service: non-destructive conversion runbook

1. **Preflight backup and rollback**: retain existing Render service config, branch `deploy/servicedesk-v3-public-review-20261011`, last successful deploy `3962aa5c84c3aa5f47ad72b62d51ae4382467708`, and rollback instructions. No force-update of that historic branch or deletion of prior deploy history.
2. **Deploy mechanism limitation**: connected Render tools can read service/deploys and trigger a deploy of its **configured branch**, but do NOT expose a safe modify-service-branch or resume/suspend control. Triggering deploy now would redeploy **old V3**, not V4. Update/unsuspend must be done through authorized Render Dashboard/Work-controlled browser or another appropriately scoped tool before any V4 deploy. Never pretend this has already happened.
3. Choose the existing service's desired branch as the **immutable, reviewed V4 release-candidate reference**, with autodeploy OFF and no new service. Do not set branch to GitHub `main` (it is thousands of commits behind).
4. Use existing primary Supabase only through **server env/secrets**; do not paste publishable/service role keys into issues or chat. Configure `NEXT_PUBLIC_SUPABASE_URL`, matching public key, callback origin `SERVICEDESK_AUTH_REDIRECT_ORIGIN`, QA allowlist. Ensure `SERVICEDESK_OWNER_REGISTRATION_ENABLED` remains **false**.
5. Render deployment metadata and `/health` must return the exact target `sourceSha` and provider `render`. [Read-only verifier](./../../scripts/delivery/verify-staging-source.mjs) requires explicitly approved HTTPS hostname; validate actual source using `SD_APPROVED_STAGING_HOST=servicedesk-v3-frontend-review.onrender.com` only after it is intentionally redeployed to V4 and accessible.
6. **Only then** run signed-in owner-A and owner-B onboarding/foreign-tenant tests with two controlled test inboxes; use uniquely labeled `SD-QA-20261025-*` isolated business fixtures, never change existing owner membership or real request. This step awaits owner email control and explicit fixture-data scope.
7. Preserve existing owners/test accounts and old Render release; cleanup of any persisted test fixtures is a separately reviewed exact-ID deletion task, never blanket `TRUNCATE` or `DROP`.

## Unresolved P02 acceptance

- **No V4 Render deployment or authenticated browser journey** (old service is suspended).
- **No second test owner** (main DB has only one confirmed auth user). Two controlled fictional test inboxes/session confirmation required. No usernames or passwords are solicited in GitHub issues.
- **Critical default-branch RPC security migration uninstalled** (0065); migration change authorization and backup/rollback required before untrusted tenant tests or public signup.
- **No real foreign tenant JWT denial proof** yet. SQL-only role/table advisory checks cannot substitute for two saved owner sessions.
- **No fake business row inserted**; source-only CI passing is not an actual onboarding acceptance.
- **P02 remains OPEN** pending these gates; do not move to P03.

## Do not add paid resources or a separate staging database/service

The owner explicitly rejected both. This shared-infrastructure plan supersedes P01's earlier recommendation for an isolated staging environment. Its security consequence is stricter tenant data hygiene, rollback and staged migration approval.
