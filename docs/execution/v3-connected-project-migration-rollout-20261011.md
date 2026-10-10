# ServiceDesk signup: connected database rollout (2026-10-11)

## Scope and owner authorization

The owner explicitly authorized using the **existing ServiceDesk Supabase project**
`cpmmgivhlkfbiwzhlcey` as a staging database, without obtaining a full project
snapshot. This does **not** authorize changes to another project, real payment
credentials, production deployment, or customer data. The target was verified
by name, project ref, status `ACTIVE_HEALTHY`, PostgreSQL 17.11, and applied
migration history before making any changes.

## Successfully applied

Source was frozen to `a84710457841dbd05f07240720e23f45989e35b1`.
These 13 migrations returned `success: true` via the Supabase migration
endpoint, in numeric source order:

- `sd_0024_v2_commercial_contract_portfolio`
- `sd_0025_v2_commercial_portfolio_read`
- `sd_0026_v2_commercial_billing_schema`
- `sd_0027_v2_commercial_billing_helpers`
- `sd_0028_v2_commercial_billing_draft_command`
- `sd_0029_v2_commercial_billing_finalize`
- `sd_0030_v2_commercial_billing_adjustments`
- `sd_0031_v2_accounting_reconciliation_schema`
- `sd_0032_v2_accounting_reconciliation_read`
- `sd_0033_v2_accounting_integration_runtime`
- `sd_0034_v2_accounting_reconciliation_record`
- `sd_0035_v2_accounting_backfill_dry_run`
- `sd_0036_v2_commercial_direct_cost_schema`

The connected Supabase migration history was re-read and independently
confirmed to contain **43 entries** (the original 30 plus these 13), with
the exact last migration `sd_0036_v2_commercial_direct_cost_schema`.
The project now reports **53 public tables** and no recorded data rows.

## Hard stop — next migration 0037

An attempt to apply `sd_0037_v2_commercial_direct_cost_command` via the
Supabase migration endpoint was **blocked by the tool's safety checks**.
It **was not applied**. No subsequent migration (0038–0059) was attempted,
because the sequence must retain its dependency ordering.

**Current schema head: 0036. Do not mark registration operational.**

The PostgreSQL 17 disposable rehearsal separately proved 66/66 clean install,
36/36 upgrade from synthetic 0023 baseline, logical restore of synthetic
baseline and verified owner-workspace RPC behavior, but this must not be
misrepresented as an accepted live migration outcome.

## Account onboarding status

- Source contains registration, confirmation, new workspace and password reset
  routes and the verified bootstrap SQL function in pending migration 0059.
- Since migration 0059 is **not applied**, the actual project still lacks
  `workspace_branches`, `branch_memberships` and
  `servicedesk_register_owner_workspace`. Applying signup UI changes alone
  cannot create a real business.
- Isolated Render preview uses the correct public project URL and publishable
  key with fixed HTTPS auth callback origin.
- `SERVICEDESK_OWNER_REGISTRATION_ENABLED=false` is intentionally retained.
- Server-side `SUPABASE_SERVICE_ROLE_KEY` access/configuration and live
  Supabase confirmation-email/redirect-allowlist checks remain outstanding.
- No real account, email confirmation, owner workspace or authenticated
  browser receipt was produced.

## Next authorized work

Resolve the blocked migration 0037 through an approved execution mechanism;
**do not skip dependencies or bypass the tool's safety check**. Re-check the
connected migration history before resuming. Then finish 0037–0059,
verify the RPC grants and branch tenancy, complete the authenticated server
configuration and confirmation-mail acceptance, and only then turn on the
owner registration flag on the isolated Render preview.

No CMS project or payment operations were touched in this rollout.
