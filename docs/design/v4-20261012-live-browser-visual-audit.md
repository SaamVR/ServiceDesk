# ServiceDesk V4 — live browser visual audit and staged corrections

Date: 2026-10-12. Scope: live **Render review** `https://servicedesk-v3-frontend-review.onrender.com`, deployed SHA `499ab9e1e55944f3484a56925c88da9bfb6dae9a`; separate exact-commit candidate tests. Do not confuse the two sources.

## Evidence matrix

| Surface | Browser check | Verified result | Evidence |
| --- | --- | --- | --- |
| Public homepage, Features, Cleaning Solutions, Pricing, Integrations, Contact, Help, Privacy, Terms, Tour, Sign-in | Real headless Chrome on published Render; 320, 390, 834, 901, 1024, 1280, 1440px; initial and mid-page snapshots; nav/selected tabs | **77 responsive checks, 169 PNG screenshots PASS**. Mobile navigation, illustrative tabs, route metadata, no horizontal viewport overflow in checked states | https://github.com/SaamVR/ServiceDesk/actions/runs/38175090583 |
| Public Signup, Verify-email guidance, Forgot password, Recovery-email guidance, Presentation | Real headless Chrome on published Render; same seven widths | **35 responsive checks and 70 screenshots PASS**. Non-submitting only | https://github.com/SaamVR/ServiceDesk/actions/runs/38175437465 |
| Public synthetic /sandbox | Real headless Chrome against published Render, four widths; all mock journey actions | **9-stage flow PASS**, failure/retry, mock transport accepted-not-delivered, ledger/reset invariants, 5 screenshots, no unexpected provider calls | https://github.com/SaamVR/ServiceDesk/actions/runs/38175252329 |
| Authentication and real Studio | **NOT ACCEPTED**. Manual protected workflows were actually attempted; source preflights pass, authenticated jobs blocked on absent protected QA Supabase URL | Not real-signed-in/browser verified or cross-tenant session-verified | https://github.com/SaamVR/ServiceDesk/actions/runs/38171034519 and https://github.com/SaamVR/ServiceDesk/actions/runs/38171036856 |

## Found visual defects

1. **Under-12px UI text**, not just decorative accents: live 320px screenshots computed some integration illustration labels at 6.4–9.3px, pricing and workflow tabs around 10.9–11.4px, mobile home signal captions around 9.4px, plus microtype in tour and registration. This passed basic browser overflow gates but failed reasonable readability criteria.
2. **Primary contrast**: the original coral `#FA785F` with white text is **2.65:1** and the original teal `#208F89` with white text is **3.92:1** (below 4.5:1 for normal text).
3. **Mobile integration diagram**: absolute-positioned 115px provider cards crowd the 115px center hub at narrow widths. Source geometry was structurally collision-prone despite page-level overflow tests passing.
4. **Tour mini-workboard**: status and stage text in three columns shrank to 8–10px on mobile; readable labels need a second row.
5. **Studio**: some actual shell rail labels were ~10.7–11.7px; restored Today workroom included supporting copy in low-contrast green-gray. The earlier synthetic sidebar test did not establish the user's actual signed-in issue.

## Corrections — source branches

- First typography sweep: `feat/servicedesk-v4-deep-visual-browser-audit-20261012`: raise 40 undersized `rem` declarations on non-home public pages and Tour; add browser audit scripts and regression tests. Full release CI + production Next/Chrome: https://github.com/SaamVR/ServiceDesk/actions/runs/38175319279
- Second typography, contrast, alignment sweep: `feat/servicedesk-v4-responsive-polish-wave2-20261012`: accessible deeper coral, dark teal nav CTA, remove homepage/auth/marketing-header microtype, mobile integration 2x2 grid, tour status wrapping, legacy test reconciliation. Requires green exact-head CI before integration.
- Actual Studio shell/Today workroom: `feat/servicedesk-v4-studio-readability-wave3-20261012`: min 12px labels, darker small caption colors (contrast >4.5:1 on white), full synthetic Chrome plus RC green at https://github.com/SaamVR/ServiceDesk/actions/runs/38175843726

## Release gates still open

1. **P0 real owner-session Studio left rail** at seven widths, populated workspace, selected-route/More Tools/focus and scroll. Synthetic CI does not close.
2. Verified QA signup, confirmation email and business creation; negative RLS with **two distinct** fictional authenticated owners. Missing GitHub protected QA credentials are a real blocker; never print secrets, invent accounts, or bypass RLS.
3. Actual authorized tenant workflows: Inbox → Request → Quote → Schedule → Job → Invoice → Quality, RBAC negative paths, provider sandbox reconciliation and failure states. The publicly accessible /sandbox is synthetic only.
4. Screenshot **visual review**, not merely generated PNGs: compare candidate production output with approved Clean Air design at each breakpoint, inspect content hierarchy and page-specific interactions, then authorize review deploy. No false claims of production readiness.

Do not merge to main or modify production database. Render review autodeploy is OFF. Reconcile any parallel branch movement with exact SHAs and exclusive file ownership before promotion.
