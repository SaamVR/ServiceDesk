# ServiceDesk V4 — real authenticated QA acceptance (not yet passed)

Last checked 2026-10-12. The connected ServiceDesk Supabase staging project is
`cpmmgivhlkfbiwzhlcey`, and the external review origin is
`https://servicedesk-v3-frontend-review.onrender.com`.

## Why the tests are blocked

- The database currently has one email-confirmed user and one owner
  workspace; two-owner RLS needs **two different authorized fictional
  owners, each in their own tenant**.
- Both protected GitHub Actions stages have been actually triggered and
  failed closed at variable-name-only preflight. Source/unit tests passed.
  [Owner attempt](https://github.com/SaamVR/ServiceDesk/actions/runs/38184245380)
  and [two-owner RLS attempt](https://github.com/SaamVR/ServiceDesk/actions/runs/38184251082).
- The Supabase project URL is public and pinned in source; it is **not** a
  secret. A publishable `sb_publishable_` key is not a service-role key.

## Set GitHub Actions protected repository secrets (not in code or chat)

For the owner browser: `SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY`,
`SERVICEDESK_QA_TEST_EMAIL`, `SERVICEDESK_QA_TEST_PASSWORD`,
`SERVICEDESK_QA_TEST_WORKSPACE`.

For the two-owner cross-tenant negative proof:
`SERVICEDESK_QA_OWNER_A_EMAIL`, `SERVICEDESK_QA_OWNER_A_PASSWORD`,
`SERVICEDESK_QA_OWNER_A_WORKSPACE`, `SERVICEDESK_QA_OWNER_B_EMAIL`,
`SERVICEDESK_QA_OWNER_B_PASSWORD`,
`SERVICEDESK_QA_OWNER_B_WORKSPACE`.

Create an independent fictional second account and workspace through the
authorized, role-checked staging product flow. Both email accounts must be
confirmed and have active OWNER memberships. Never create a fabricated
membership with raw admin SQL, copy production user data into QA, bypass RLS,
or use `service_role` to make these proofs pass.

## Acceptance checklist

- [ ] Live signed-in real owner sees the **actual** Studio Overview and all
      thirteen navigation destinations; no clipped/invisible sidebar at
      320, 390, 834, 901, 1024, 1280 or 1440px.
- [ ] Mobile navigation opens/closes via keyboard, Escape returns focus,
      Tab is trapped inside the drawer, no scroll leak.
- [ ] Staff roles route to permitted modules and are denied owner-only
      settings/model diagnostics.
- [ ] Two confirmed separate owner sessions each see their own workspace and
      nothing from the other in workspaces, memberships, branches, customer,
      properties, requests and invoices (positive and negative RLS).
- [ ] Authorized request → quote → capacity check → visit → invoice →
      quality follow-up has real persisted readbacks under the user session.
- [ ] Explicit AI model diagnostic returns a **real provider** response
      (not just configured status), and the saved-request brief remains
      read-only and subject to human review. Never call a provider without
      an authorized owner click and proper server-only credentials.
- [ ] Sandbox payment and WhatsApp/Calendar/email delivery receipts separately
      verified and reconciled; an accepted request is not a delivered message,
      and a checkout is not a paid invoice.
- [ ] Release approver reviews private screenshots, provider receipts and
      error/denial paths before declaring the product sellable.

CI scripts: `scripts/release/v4-protected-qa-preflight.mjs`,
`scripts/release/v4-authenticated-sidebar-chrome.mjs`, and
`scripts/release/v4-private-rls-proof.mjs`.
No automated public smoke or fixture-based dashboard test should be
substituted for these protected gates.
