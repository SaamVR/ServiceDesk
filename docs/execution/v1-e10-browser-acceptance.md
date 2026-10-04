# ServiceDesk V1 E10 Browser Acceptance Spec

Status: `BROWSER_ACCEPTANCE=TO_RUN_CONFIGURATION_BLOCKED`

This document defines the browser journey to run once the executable runtime, package install, browser driver and canonical app build are available. It does not claim browser PASS.

## Required viewports

- desktop: `1440x900`
- tablet: `834x1112`
- mobile: `390x844`

## Journey

1. Public business enquiry: open the business enquiry route, verify labels, required fields, accessible form names and no horizontal overflow.
2. Request summary and quote: verify quote version, total/deposit/balance labels and no optimistic acceptance state.
3. Slot/checkout: verify stale slot/hold/payment states are labelled; Stripe/payment remains `SANDBOX` unless a later controlled provider receipt proves otherwise.
4. Customer overview/invoice/preferences: verify invoice is read-only for customer and staff manual payment is not exposed.
5. Staff attention/inbox/CRM/quotes/schedule/jobs: verify navigation, typed server-boundary cards, pending/error/success states and no fixture/live mislabelling.
6. Crew today/job: verify assigned visit flow, valid crew transition availability only, accessible focus, and no staff-only reporting/billing/inbox access.
7. Field evidence: verify evidence/checklist render as DTO/read-compatible while submission remains disabled until Core evidence command acceptance.
8. Recurrence: verify `nextOccurrenceOn` comes from DTO only; no generated future visits are synthesized in Product.
9. Invoice/manual payment: verify staff-only manual payment boundary, idempotency/version conflict state, and no client-side balance mutation.
10. Quality: verify START_REVIEW/ASSIGN/RESOLVE/REQUEST_REVIEW controls depend on injected accepted action availability; no optimistic mutation.
11. Recovery/automations: verify known and unknown attention items remain human-owned/read-only.
12. Reports/platform billing/settings/onboarding: verify `ReportingSnapshotDTO`, `PlatformBillingSnapshotDTO`, `OwnerSettingsSnapshotDTO`, and integrations reach the reusable previews; sandbox provider mode is never rendered as live; owner-input gaps are not misreported as provider failures.

## Assertions per viewport

- Primary navigation renders and current route is indicated.
- Primary actions are keyboard focusable and have accessible labels.
- Pending/error/success state copy is visible where applicable.
- No horizontal overflow.
- Fixture wrappers show `FIXTURE_UI_ONLY`; server previews show server snapshot labels; provider modes show `FIXTURE`, `SANDBOX`, or `LIVE` truthfully.
- The guided enquiry → paid job → crew → quality → invoice/reporting flow is coherent without claiming provider-live receipts.

## Release note

Browser acceptance remains blocked until `pnpm`, package install/build, and browser automation are available in the canonical runtime. When those are restored, run this spec on desktop, tablet and mobile before changing this status to PASS.
