# ServiceDesk V3 — Signup PostgreSQL 17 rehearsal evidence

**Captured:** 2026-10-11 (Asia/Dhaka)  
**Source commit:** `a84710457841dbd05f07240720e23f45989e35b1`  
**Status:** `DISPOSABLE_REHEARSAL_PASS / CONNECTED_PROJECT_BACKUP_BLOCKED / LIVE_SIGNUP_DISABLED`

## Tested source and target classes

Repository: `SaamVR/ServiceDesk`. Exact SQL inventory: 66 files, numerically
ordered 0001 through `0059_v3_verified_owner_workspace_bootstrap.sql`.
Tested on local, unexposed `postgres:17` Docker instance named
`servicedesk-pg17-rehearsal-20261011` on authorized device `samai`.
Synthetic minimal Supabase `auth.users` and `auth.uid()` facade and test roles
were used **only inside the disposable database**. No real accounts, secrets or
production records were copied.

### Clean schema installation

All **66/66** SQL migrations applied successfully on PostgreSQL 17.

A preceding PostgreSQL **12** attempt stopped at migration 0008 because it
does not support `ON DELETE SET NULL (column_name)`. This is a PostgreSQL
version mismatch, **not a failing V3 migration**. PostgreSQL 12 results are
not release evidence.

### Verified owner bootstrap security behavior — synthetic only

The actual `public.servicedesk_register_owner_workspace` SQL function was
called through `SET ROLE authenticated` with synthetic JWT subject IDs:

| Operation | Verified return |
|---|---|
| Verified first owner signup | `ok=true, existing=false` |
| Repeated owner signup for another slug | `ok=true, existing=true`, same original slug |
| Second verified user requests occupied slug | `ok=false, code=SLUG_UNAVAILABLE` |
| Second verified user creates new slug | `ok=true, existing=false` |
| Unverified synthetic user attempts signup | `ok=false, code=EMAIL_VERIFICATION_REQUIRED` |
| Final workspace / owner / default branch / branch membership / audit counts | Exactly `2 / 2 / 2 / 2 / 2` |
| Function EXECUTE privilege | `authenticated=true`, `anon=false` |

This validates *synthetic SQL function behavior*, not the live Auth email
provider or real account confirmation.

### Upgrade from the current baseline with existing records

A separate isolated PG17 database was created from the same 30 SQL files
through `0023_v2_team_invitation_lifecycle.sql`. Inserted one synthetic
existing auth account, owner workspace, customer, request and conversation.

A **physical-file-independent logical snapshot** of the synthetic baseline
was captured before upgrade:

- File (authorized device only):
  `/tmp/servicedesk-pg17-baseline0023-20261011.dump`
- Size: **402,138 bytes**
- SHA-256:
  `d17de9c78cb89c30576801ab9ee50982e3d0c2d5c1b996832813f9d5d04a7ad5`

The subsequent **36/36 pending migrations (0024–0059)** applied successfully.
The existing synthetic workspace, membership, customer, request and conversation
were preserved, and 0053 created its corresponding default branch and branch
membership. Counts after upgrade: `1 / 1 / 1 / 1 / 1 / 1 / 1` respectively
(workspaces / members / customers / branch-scoped requests / branch-scoped
conversations / default branches / branch memberships).

The exact pre-upgrade logical snapshot was then restored successfully into
a distinct clean PostgreSQL 17 database. Restored counts:
`workspaces=1, requests=1, conversations=1`.

**This restores a synthetic baseline only. It is not a backup of the
connected ServiceDesk Supabase project.**

## Connected project read-only preflight

Target is solely the authorized Supabase project `ServiceDesk` ref
`cpmmgivhlkfbiwzhlcey`, organization `ECom CMS`.

- Project status: `ACTIVE_HEALTHY`, PostgreSQL **17.11**.
- Applied migration history: **30 migrations** through `0023`.
- Missing main-project `workspace_branches`, `branch_memberships`,
  and owner bootstrap RPC `servicedesk_register_owner_workspace`.
- Aggregated live project checks: **0 Auth users, 0 storage objects**,
  **0 rows in sampled workspaces, memberships, customers, requests,
  conversations and visits**; the connected `list_tables` API reports `rows=0`
  for **all 39 public tables** and `rls_enabled=true` for each of them. The
  `pg_stat_user_tables` public row estimate was likewise `0`. These are
  read-only administrative metadata checks, **not a restorable project backup**.
- Supabase organization plan: `free`; no usable managed point-in-time
  snapshot/export capability was exposed by the connected Supabase tools.
  An independent CLI token on `samvr` returned **403** on Supabase backup
  enumeration for this project. No database password or privileged dump
  connection is available to this execution.
- Supabase branch listed hourly cost **$0.01344/hour**. Creating a paid branch
  requires separately confirmed cost acceptance; none was created.

## Preview configuration / live acceptance

Non-secret/public connection configuration was merged into Render preview
`srv-db2mhaegekts73fh4dg0` (isolated gate) only:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: active modern publishable key
- `SERVICEDESK_AUTH_REDIRECT_ORIGIN`: the trusted preview HTTPS origin
- `SERVICEDESK_OWNER_REGISTRATION_ENABLED=false` (**fail closed**)

No secret key contents are included here. Preview redeployed successfully.
Real Chromium after that deploy still showed `/onboarding` as
`Workspace setup is temporarily unavailable`; the server-only
`SUPABASE_SERVICE_ROLE_KEY` or other runtime configuration remains
inaccessible or absent. `/auth/sign-up` displays its disabled release state.

## Decision and missing authorization/capability

**The connected project was deliberately NOT mutated.** The owner's approval
specified that a recoverable backup and safety checks precede upgrade. The
PostgreSQL 17 rehearsal passes; however a real connected-project backup has
not been obtained. The source-controlled migrations alone do not constitute
that backup, and an isolated branch without copied production data would not
by itself protect existing project state.

Before migrations are applied to the connected project, resolve one of:

1. Arrange a restorable `pg_dump` of that specific project via an authorized
   privileged connection (preferably into a secure file on `samvr`) and
   verify its checksum/restore; **or**
2. Obtain explicit owner authorization to proceed on this effectively empty
   non-production project **without a full project snapshot**.

Once that gate closes, apply 0024–0059 in source order, review Supabase Auth
email templates and trusted redirect allowlist, securely provision the
existing server-only key into the Render preview (without printing its value),
send a controlled confirmation email, verify first owner workspace creation
and authenticated dashboard, and enable registration **only after** completion.

No real Auth signup, email-verification receipt, project migration, browser
staff acceptance, live-payment operation, customer-data mutation or production
release is claimed in this evidence.
