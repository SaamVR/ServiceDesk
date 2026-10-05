# ServiceDesk V2 — Cycle 2 Worker 1: Product Foundation Hardening

Date: 2026-10-05
Worker: W1 Product UI
Accepted W1 source head: `c5f7dc0b700e49688cce6100795aa6c093359f74`
Integration branch: `feat/servicedesk-v2-integrate`

## Accepted from Cycle 1

- professional staff application shell
- grouped sidebar navigation and responsive mobile navigation
- reusable page primitives
- operational visual tokens and responsive/a11y safeguards
- staff Overview no longer uses `OperationalFixtureRoute`
- data-truthful `StaffOverviewDashboard`
- internal release wording removed from marketing footer

## Integration caveat

`StaffOverviewDashboard` accepts `WorkspaceSnapshot`, but the current Overview route invokes it without an authoritative snapshot. The UI foundation is accepted; authoritative Overview loading/wiring belongs to the operational-product/shared integration lane. Do not fabricate data to close this.

## Cycle 2 mission

Continue the reusable professional product foundation without colliding with Worker 2 feature-route wiring.

1. Run a fresh executable gate on the integrated W1 source: typecheck, focused tests, lint, build where available. Repair W1-owned regressions before new work.
2. Build reusable operational primitives needed across Worker 2 screens:
   - DataTable/table shell with accessible header/row/action treatment
   - list/detail split layout
   - filter/search toolbar
   - tabs
   - form field/group/help/error primitives
   - modal/drawer/sheet pattern only if it can remain dependency-light
   - skeleton/loading/error/empty states
   - toast/inline feedback pattern
3. Harden desktop/tablet/mobile shell behavior, focus states, overflow and long-label handling.
4. Remove remaining presentation/demo styling from shared authenticated-shell surfaces only. Do not rewrite Worker 2 feature routes.
5. Keep animation restrained and reduced-motion safe.
6. Add focused UI/structural tests where the repository conventions support them.
7. Commit/push multiple substantive slices; do not stop after one primitive.

## Ownership

W1 owns shared UI primitives, shell, global/responsive visual system and generic page scaffolding.
W2 owns operational route semantics/data wiring.
W3 owns V2 field/dispatch feature logic and field-specific UX.

## Completion

Return:
`SERVICEDESK_W1_PRODUCT_FOUNDATION_CYCLE2_COMPLETE`
or
`SERVICEDESK_W1_PRODUCT_FOUNDATION_CYCLE2_PARTIAL_BLOCKED`

Include branch, exact HEAD, checks, components exported for W2/W3, remaining work and exact blockers.
