# ServiceDesk V3 — isolated staging provenance and signed-out preflight

**Status:** Implementation and contract validation only until an owner-approved staging URL,
an exact deployed SHA receipt, and a real authenticated browser session exist.

## Purpose

Previous Render V2 previews and successful GitHub Actions builds are **not evidence**
that the latest V3 application has been deployed. The `/health` GET retains its
existing public liveness fields and can now additionally publish the 40-character
immutable Git SHA supplied directly by the runtime's hosting platform:

- Render: `RENDER_GIT_COMMIT`
- Vercel: `VERCEL_GIT_COMMIT_SHA`

The value is omitted when neither is present, either is malformed or they disagree.
No deploy credentials, project IDs, emails, customer data, remote IPs or environment
variables are returned. `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`
are set. Even a matching **host-reported** SHA is not independent proof: reconcile
it with the provider's authenticated deployment metadata and the exact GitHub
Actions success receipt.

## Read-only candidate preflight

Run in an owner-approved **nonproduction** environment only. No default URL is
accepted; every parameter must be explicitly supplied. No authenticated browser
cookies or service-role keys are used. Do not point this at production.

```sh
V3_STAGING_PERMISSION=1 \
V3_STAGING_ORIGIN=https://<approved-staging-host>/ \
V3_STAGING_ALLOWED_HOST=<approved-staging-host> \
V3_STAGING_EXPECTED_SHA=<exact-40-character-integrated-commit> \
V3_STAGING_QA_WORKSPACE=<approved-isolated-workspace-slug> \
node scripts/release/v3-staging-source-preflight.mjs
```

The script issues only these bounded, redirect-disabled **GET** requests:

1. `/health`: status 200, exact ServiceDesk JSON identity, matching host-provided SHA.
2. `/auth/sign-in`: status 200, real email/password form controls.
3. `/api/internal/inbox/delivery?workspaceSlug=...`: without cookies it **must**
   return 401. A 200, redirect, unavailable backend or partial authorisation is a fail.

Only check labels, statuses and HTTP codes are printed. There are no account
mutations, provider sends, AI model calls, DB schema changes or screenshot
uploads. `PREFLIGHT_PASS` means the **host-reported** SHA matched and the
anonymous checks passed; flags for independent hosting attestation, authenticated
browser acceptance and provider receipt stay `false`.

Regressions are run through the existing Node release-smoke gate:
`node --test scripts/release/v3-staging-auth-smoke.test.mjs` imports the
new no-network `v3-staging-source-preflight.test.mjs` suite. The TS host
identity tests run in the existing frontend test aggregation.

## Pending migration source manifest (never an apply receipt)

A bounded local-source inventory can be supplied to the authorized database
operator without a Supabase connection:

```sh
node scripts/release/v3-migration-source-audit.mjs
```

It checks that **exactly one** SQL file exists for each ordered migration
0037 through 0059, records each source SHA-256 and verifies the 0059
verified-email owner-bootstrap function and restrictive
`EXECUTE` grant markers. The status
`SOURCE_CHAIN_PRESENT_DB_APPLICATION_UNVERIFIED` explicitly means that
**no connected database migration was verified or executed** by the audit.
The audit is also exercised by the existing Node release-smoke CI tests.
It does not grant migration authorization or bypass the open #75 0037
execution safety block.

As of the 2026-10-11 read-only connector check, the authorized ServiceDesk
Supabase project reported 43 migration-history entries, ending at
`sd_0036_v2_commercial_direct_cost_schema`. Do not enable owner registration
until 0037..0059 are safely applied and validated in the approved target.

## Remaining mandatory acceptance

- Verify the exact deployment/source SHA *out of band* using hosting metadata
  and its release/job receipt. A typed SHA or a screenshot is not sufficient.
- Establish a real approved isolated tenant, configured migrations and
  authorised operator account. Do not bypass open migration issue #75, or enable
  public signup merely because this read-only smoke passes.
- Run `tests/e2e/v3-capture-workroom.mjs` from a private QA Chromium profile
  **outside Git**, for Today, Inbox, Schedule, Jobs, Quality, Customer Collections,
  Commercial Accounts and Settings at 320, 390, 834, 1280 and 1440 CSS pixels.
  Keep all 40 screenshots confidential; validate accessibility, focus,
  reduced-motion, usable density and owner visual signoff separately.
- Execute end-to-end explicit-review WhatsApp/Email message and receipt,
  real Calendar timezone/holds, Stripe **sandbox** invoices/payment events,
  signup/verification/invitation, branch access and Supabase/RLS negative cases,
  each with its own controlled evidence. Never equate queued/provider accepted
  with delivered/read.
- Keep feature flags `SERVICEDESK_AI_ENABLED` and durable Meta delivery status
  disabled until their separate acceptance and approval gates.

This preflight is an additional fail-closed check; it does not replace
`pnpm check:rc`, a browser test, a provider receipt or a release decision.
