# ServiceDesk AI V3 — Registration and Recovery Release Gate

Date: 2026-10-10. Current state: **CONTRACT_TESTED, CONFIGURATION_BLOCKED**.
This is an exact-implementation runbook, not provider or production evidence.

## Observed source-of-truth baseline

- Canonical repository: `SaamVR/ServiceDesk`; V3 implementation PR #68, Inbox PR #69, product story PR #70.
- Connected **ServiceDesk** Supabase project currently reports migrations only
  through `sd_0023_v2_team_invitation_lifecycle`. No development branch exists.
- Repository source includes 0024–0058 and V3 migration
  `0059_v3_verified_owner_workspace_bootstrap.sql`.
- Current isolated Render preview `https://servicedesk-v2-multilane-gate.onrender.com`
  is not configured for verified account registration.
- Do not treat a React/TypeScript/build PASS as provider email-delivery evidence.
- No real customer, billing, payment or production database changes authorized by this run.

## Exact runtime configuration (do not store values in repository)

| Variable / setting | Meaning | Ready criterion |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Authorized non-production Supabase API URL | Matches the rehearsed target |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable browser-safe key | From exactly that target; never service_role |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only authorized operational snapshot key | Server runtime only, not `NEXT_PUBLIC_` |
| `SERVICEDESK_AUTH_REDIRECT_ORIGIN` | Server-approved HTTPS origin, no path or query | `https://servicedesk-v2-multilane-gate.onrender.com` if that preview remains the target |
| `SERVICEDESK_OWNER_REGISTRATION_ENABLED` | Fail-closed self-registration release switch | Set to `true` **only after** all following receipts pass |
| Supabase Auth redirect allow-list | Signup and recovery completion | Allows `/auth/confirm` and recovery `/auth/confirm?flow=recovery` for exact authorized origin |
| Supabase SMTP/email templates | Verified sender and customer-requested messages | Controlled consenting test mailbox receives confirmation and recovery links |

Never print, persist or copy publishable/project credentials into evidence logs.

## Required, ordered non-production migration proof

1. Enumerate the actual target's applied migration history; do not assume it
   matches the repository solely because 0023 is the last recorded migration.
2. Create **isolated disposable synthetic-only** database or an explicitly
   authorized nonproduction Supabase branch with a verified rollback method.
3. Validate migration 0023→0059 in repository-defined numeric/suffix order.
   In particular 0053 creates `workspace_branches` and
   `branch_memberships` required by 0059. Never apply 0059 alone.
4. Independently rehearse clean installation, upgrading the 0023 baseline,
   idempotent reconciliation, and full disposal/restore. Record exact schema
   head, build SHA and migration inventory fingerprint using existing
   `migration-rehearsal.ts` utility. Do not fabricate receipts.
5. Run advisors and verify RLS on every exposed table, function EXECUTE
   privileges and tenant/branch isolation. The new verified signup function
   must not grant ownership in an existing workspace.
6. Only after owner approval may migrations and runtime settings be applied
   to an explicitly named nonproduction environment. Nothing here authorizes
   production database work, provider calls or credential rotation.

## End-to-end acceptance matrix (requires real non-production environment)

| Journey | Expected result |
|---|---|
| Signup with valid email/password | Neutral check-email screen; no membership before verification |
| Existing email signup attempt | No account existence disclosure |
| Invalid/expired confirmation | Generic failure; no owner workspace |
| Confirmed email → business setup | Authenticated verified account may choose name, slug, timezone, currency |
| Create business workspace | One atomic workspace, OWNER/ACTIVE membership, MAIN branch, linked branch membership, audit receipt |
| Duplicate / concurrent submission | Does not create a second workspace; no cross-tenant owner assignment |
| Invalid/taken slug | Clear error without partial writes |
| User with no membership | Cannot read another company's workspace |
| Existing staff / crew login | Retains authorized route/role without self-promotion |
| Recovery request for known/unknown email | Same neutral UI confirmation |
| Recovery confirmation | New password can be saved only in authenticated recovery session |
| Recovery success | Password updated, session signed out, explicit fresh login |
| Mobile 320/390; tablet 834; desktop 1440 | Form fields, focus, error states and menu remain usable without overflow |
| Release flag disabled | Signup fields are disabled; server actions reject account and workspace creation |

## UI / business acceptance after onboarding

Use the newly-created synthetic OWNER account to capture **real authenticated
Chromium screenshots** of Overview, Inbox, Schedule, Jobs, Invoices, and
Settings at 1440, 834, 390 and 320 widths. Test both empty state and
controlled realistic synthetic business records. Verify all commands against
existing PostgreSQL authorization; do not claim fixture tour evidence as
authenticated staff evidence.

The Stripe/payment policy remains **SANDBOX / DEMO ONLY**.

## Status definitions

- Registration/recovery source and tests: **CONTRACT_TESTED** after exact SHA
  quality gate passes.
- Email callbacks, workspace RPC deployment and real account creation:
  **CONFIGURATION_BLOCKED**, not PROVIDER_VERIFIED.
- Production readiness: requires separate authorized deployment, migration,
  tenancy, backup/restore and provider receipts.
