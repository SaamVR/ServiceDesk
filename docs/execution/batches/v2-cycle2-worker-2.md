# ServiceDesk V2 — Cycle 2 Worker 2: Operational Product Integration Closure

Date: 2026-10-05
Integration base after W1/W2 merge: `63a79e7810684fd2f6f36664e08b142b7aa90118`
Integration branch: `feat/servicedesk-v2-integrate`

## Accepted from W2

The 45-commit W2 operational conversion is integrated:
- authenticated Supabase-backed staff runtime
- live staff routes for Inbox, Customers, Requests, Quotes, Schedule, Jobs, Invoices, Quality, Automations, Reports, Billing, Settings
- authoritative V1 command facade reuse for supported mutations
- scoped customer portal runtime/routes
- public business catalog runtime/routes
- unsupported operations remain disabled rather than faked
- production route guards/tests

## Mandatory integration defects to close first

1. `OperationalProductRoute` still renders a legacy `site-shell/site-header` and staff navigation inside the new W1 `StaffAppShell`. Production staff pages therefore risk nested/duplicate shells. Make OperationalProductRoute content-only under the shared app layout.
2. Staff Overview has W1's professional dashboard but still lacks authoritative `WorkspaceSnapshot` wiring.
3. W2 feature views still use legacy local presentation CSS/classes instead of W1 primitives in many places.
4. Some supported operations remain unavailable from the product because the route/action seam is not yet connected.
5. Need an integrated executable gate after W1 + W2 + W3 source merge.

## Cycle 2 mission

1. Run focused typecheck/tests first; fix integration compile failures immediately.
2. Remove duplicate staff shell/header/nav from OperationalProductRoute. Staff workspace layout owns the shell.
3. Add a production Overview loader/adapter that produces the real data required by StaffOverviewDashboard. Reuse existing authenticated workspace/runtime data. Do not invent metrics.
4. Adopt W1 shared primitives for staff feature surfaces where practical: PageHeader, DataTable, WorkspacePrimitives, FormPrimitives, feedback states, dialogs/drawers.
5. Preserve all W2 authoritative Supabase/server-action semantics.
6. Ensure action redirects/notices/errors work correctly inside the shared shell.
7. Close the most important disabled-but-supported V1 actions by inspecting existing facade contracts first. Do not invent persistence.
8. Expose clean integration seams for W3 dispatch intelligence inside Schedule/Jobs without duplicating its domain logic.
9. Confirm staff routes no longer depend on OperationalFixtureRoute / FIXTURE_UI_ONLY.
10. Run focused route tests, operational runtime tests, typecheck, lint/build where available.
11. Commit/push multiple substantive slices.

## Ownership

W2 owns operational semantics, route loaders/actions, Overview live data wiring, and adoption of W1 primitives in staff routes.
W1 owns visual/shared foundation and customer/public polish.
W3 owns field/dispatch domain logic and Crew-specific productization.

## Completion

Return:
`SERVICEDESK_W2_OPERATIONAL_PRODUCT_CYCLE2_COMPLETE`
or
`SERVICEDESK_W2_OPERATIONAL_PRODUCT_CYCLE2_PARTIAL_BLOCKED`

Report exact branch/head, duplicate-shell closure, Overview data source, routes updated, commands connected, tests/checks, W3 integration seams and remaining blockers.
