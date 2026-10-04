# ServiceDesk V1 E10 Browser Acceptance Spec

Status: `BROWSER_ACCEPTANCE=TO_RUN_CONFIGURATION_BLOCKED`

This document defines the browser journey to run once the executable runtime, package install, browser driver and canonical app build are available. It does not claim browser PASS.

## Required viewports

- desktop: `1440x900`
- tablet: `834x1112`
- mobile: `390x844`

## Journey

1. Public business enquiry: open the business enquiry route, verify labels, required fields, accessible form names and no horizontal overflow.
2. Request update and deterministic quote: verify request summary, quote version, total/deposit/balance labels and no optimistic acceptance state.
3. Staff send/customer quote acceptance: open `/portal/quotes/[id]`, verify Accept quote is enabled only for eligible quote status plus injected handler, and that success uses the returned `QuoteDTO`.
4. Availability and slot hold: verify `findSlots(ctx,input)` supplies authoritative slots; selected slot must be fresh; `holdSlot(ctx,slotId,quoteId,meta)` shows authoritative hold expiry.
5. Sandbox checkout launch: verify button is enabled only for accepted quote + valid hold + injected sandbox checkout handler; launch state reads `SANDBOX CHECKOUT LAUNCHED / PAYMENT PENDING`.
6. Payment truth boundary: verify checkout launch does not render paid, receipt verified, visit confirmed or live mode. Invoice/Visit state changes require later verified payment flow/webhook evidence.
7. Customer overview/invoice/preferences: verify invoice is read-only for customer and staff manual payment is not exposed.
8. Staff attention/inbox/CRM/quotes/schedule/jobs: verify navigation, typed server-boundary cards, pending/error/success states and no fixture/live mislabelling.
9. Crew today/job: verify assigned visit flow, valid crew transition availability only, accessible focus, and no staff-only reporting/billing/inbox access.
10. Quality/recovery/reporting/settings/onboarding: verify server DTOs reach reusable previews; sandbox provider mode is never rendered as live; owner-input gaps are not misreported as provider failures.

## Assertions per viewport

- Primary navigation renders and current route is indicated.
- Primary actions are keyboard focusable and have accessible labels.
- Pending/error/success state copy is visible where applicable.
- No horizontal overflow.
- Fixture wrappers show `FIXTURE_UI_ONLY`; server previews show server snapshot labels; provider modes show `FIXTURE`, `SANDBOX`, or `LIVE` truthfully.
- The guided enquiry → quote acceptance → hold → sandbox checkout launch → verified webhook → paid job → crew → quality → invoice/reporting flow is coherent without claiming provider-live receipts.

## Release note

Browser acceptance remains blocked until `pnpm`, package install/build, and browser automation are available in the canonical runtime. When those are restored, run this spec on desktop, tablet and mobile before changing this status to PASS.
