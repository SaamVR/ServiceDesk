# ServiceDesk V2 — Cycle 3 Worker 1: Integrated Product Polish

Date: 2026-10-05
Integration base: `ac8330779183c1993f0bfbbc57e000be2fb0c738`
Integration branch: `feat/servicedesk-v2-integrate`

## Accepted foundation

W1 Cycle 1 and Cycle 2 are integrated:
- StaffAppShell and responsive navigation
- shared product design tokens
- PagePrimitives
- DataTable
- split workspace / toolbar primitives
- form primitives
- feedback/loading/error primitives
- dialog/drawer
- focus/responsive contracts

W2 operational product is now also integrated:
- authenticated staff runtime
- live staff routes for Inbox/Customers/Requests/Quotes/Schedule/Jobs/Invoices/Quality/Automations/Reports/Billing/Settings
- customer portal runtime/routes
- public business runtime/routes
- existing authoritative V1 commands for supported mutations

## Cycle 3 mission

Polish the now-real product surfaces. Do not build more demo components and do not change business authority.

1. Inspect integrated staff/customer/public screens and replace legacy presentation styling with the W1 shared UI system.
2. Do not alter authoritative loaders/actions unless a tiny typing seam is necessary.
3. Focus on public/business and customer portal shell/visual architecture to reduce overlap with W2.
4. Standardize page headers, content width, tables/lists, status badges, forms, empty/error/loading states, detail panels and mobile behavior.
5. Remove duplicate legacy CSS where safe; do not blindly delete classes still used by tour/presentation.
6. Perform browser/viewport checks when available at 1440x900, 834x1112, 390x844.
7. Repair visual regressions, nested overflow, low-contrast states and mobile action stacking.
8. Keep /tour and /presentation isolated and clearly non-production.
9. Use no fake data and no internal engineering language in product UI.
10. Run focused tests/typecheck/lint/build and commit multiple substantive slices.

Return:
`SERVICEDESK_W1_INTEGRATED_PRODUCT_POLISH_COMPLETE`
or
`SERVICEDESK_W1_INTEGRATED_PRODUCT_POLISH_PARTIAL_BLOCKED`.
