# P02 — real two-owner read-only acceptance on the EXISTING ServiceDesk Supabase

**Decision:** keep existing main Supabase `cpmmgivhlkfbiwzhlcey` and original Render service. No new resources, users, messages, charges, migrations or deployments are authorized by this document.

## Required prerequisites — cannot be skipped

- The owner-approved default-branch security repair (source `0065`) is **ACTUALLY installed and recorded** in the main Supabase migration ledger. It was previously blocked by connector safety controls; GitHub source alone is insufficient. Confirm installed function returns NULL for unrelated owners and retains own-branch behavior. See [security-only migration handoff](./P02_AUTHORIZED_0065_MIGRATION_HANDOFF.md).
- Two **real distinct controlled QA owner identities** are authenticated through Supabase Auth with separately owned workspaces. One pre-existing owner currently exists; do not invent another, reuse its token or insert fake user IDs in the primary database.
- A supported deployment/secret environment can supply each real owner access JWT, **publishable** project key and expected owner workspace UUID without printing or committing them. Do not put tokens in GitHub issues, ChatGPT, CLI arguments or checked-in `.env` files.
- Read-only API access remains enabled. The tool cannot create accounts, fix RLS or switch Render source.

## Runnable acceptance probe

**Source:** [`scripts/release/v4-p02-two-owner-readonly-acceptance.mjs`](https://github.com/SaamVR/ServiceDesk/blob/ops/p02-real-two-owner-readonly-supabase-probe-20261025/scripts/release/v4-p02-two-owner-readonly-acceptance.mjs) (PR [#844](https://github.com/SaamVR/ServiceDesk/pull/844), merge verification pending at authorship).

The operator's private environment supplies:

| Variable | Description |
|---|---|
| `SD_P02_ACCEPTANCE_APPROVED` | Must equal literal `READ_ONLY` |
| `SD_P02_PUBLISHABLE_KEY` | The main project's `sb_publishable_...` key, never a service-role/secret key |
| `SD_P02_OWNER_A_JWT` | Real owner A's authenticated Supabase access token |
| `SD_P02_OWNER_B_JWT` | Real owner B's authenticated Supabase access token |
| `SD_P02_OWNER_A_WORKSPACE_ID` | UUID of owner A's own business |
| `SD_P02_OWNER_B_WORKSPACE_ID` | UUID of owner B's own business |

Run `node scripts/release/v4-p02-two-owner-readonly-acceptance.mjs` from the verified source checkout **after** setting those values in a secure ephemeral runner environment. The script refuses to run without explicit READ_ONLY consent, two distinct signed-in subjects, different workspaces, project-correct issuers and unexpired tokens.

The code pins API requests to `https://cpmmgivhlkfbiwzhlcey.supabase.co`. It sends GET requests for tenant-scoped workspaces, memberships and requests and POST requests solely to the audited **read-only** `servicedesk_default_branch` function. There are **no** inserts, updates, deletes, user signups, outbound messages or payments. All redirects are rejected. Errors and successful output are sanitized; do not print live JSON responses elsewhere.

### Success criteria

- Owner A sees their own workspace, membership and default branch; sees ZERO tenant rows for owner B and receives NULL from default branch RPC for B.
- Owner B reciprocally sees their own workspace, membership and default branch; sees ZERO rows for owner A and receives NULL for A.
- The test does NOT require either owner to already have a request; requests are tested for foreign leakage only.
- If the known pre-patch foreign branch-ID leak remains, the runner MUST FAIL even if all regular RLS reads deny foreign access.
- **Result must include the exact V4 source SHA and provider environment receipt** in the P02 issue; no owner UUID/JWT or email in the issue.
- A passing direct Supabase read-only probe still does not prove Render V4's browser session, onboarding POST flow, or third-party providers. These are separate acceptance steps.

### Offline safety regression

`node --test scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs` uses synthetic JWT-like test objects and a mocked fetch layer; it never makes network calls. At initial creation, 5/5 offline cases PASS, including unexpected foreign rows and the vulnerable branch helper; these do not prove main database acceptance.

## Other P02 acceptance gates

1. Existing [Render V3 review service](https://dashboard.render.com/web/srv-db5p1s142hec739noohg) is currently suspended and divergent. The owner selected reuse, **but changing its branch or resuming it still requires a separate, carefully backed-up service-write authorization and a supported dashboard/Work action**.
2. The V4 build `/health` `sourceSha` must equal an exact reviewed Git commit and the hosting metadata. The existing service's V3 deploy SHA `3962aa5c84c3aa5f47ad72b62d51ae4382467708` is the rollback reference, **not a V4 deployment receipt**.
3. Two signed-in browser owners must each complete registration/onboarding and be unable to access the other's owner pages or saved rows. No real customer data and no automatic outbound/provider sends.
4. Any QA fictional record insertion into the **same main database** requires its own server-only opt-in `SERVICEDESK_QA_FIXTURE_WRITES_APPROVED=true` plus an exact allowed workspace slug in `SERVICEDESK_QA_FIXTURE_WORKSPACE_SLUGS`; neither should be set before owner review. No blanket seeding of the existing user's business.

**Tracking:** [P02 issue #818](https://github.com/SaamVR/ServiceDesk/issues/818). This runbook does not authorize any connection/secret mutation or bypass of the blocked migration.
