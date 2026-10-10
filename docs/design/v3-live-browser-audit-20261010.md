# ServiceDesk AI — V3 Product Design Audit & Implementation Direction

Date: 2026-10-10. Status: **REAL PUBLIC BROWSER AUDIT**, authenticated staff audit still blocked.

## Evidence: observed in real Chromium, not inferred from source

Executed Playwright + Chromium against the *live isolated Render candidate*
`https://servicedesk-v2-multilane-gate.onrender.com`.
Capture context: 1440×900 desktop, 390×844 mobile, JavaScript enabled,
DOM loaded, waited for page settlement. Screenshots on authorized browser-audit
device: `/tmp/servicedesk-audit-{home-desktop,home-mobile,login-desktop,login-mobile,tour-desktop,onboarding-desktop}.png`.
These paths are device-local audit evidence, NOT deploy/public paths.

| Route | Browser-observed outcome | Product issue |
|---|---|---|
| `/` | HTTP 200; hero "Run cleaning operations from enquiry to paid job"; Arial/Helvetica; no horizontal overflow or page errors at both audited sizes | Giant gray slab, flat typographic hierarchy, generic conversation fixture as main proof, excessive technical text |
| `/auth/sign-in` | HTTP 200; email/password only; no Create Account | Signup dead end; tiny isolated card with no product story or first-run progression |
| `/tour` | HTTP 200; title "Controlled tour in an isolated showcase workspace"; `FIXTURE_UI_ONLY` and `CONFIGURATION_BLOCKED` directly exposed | Public presentation reads like an internal QA/evidence sheet instead of a business walk-through |
| `/onboarding` | HTTP 200; "Onboarding unavailable", "Workspace setup is temporarily unavailable" | Not a working self-service onboarding journey on deployed preview |
| Staff `/app/[workspace]/*` | NOT AUTHENTICATED / NOT SCREENSHOT-AUDITED | No verified staff session; visual acceptance here must not be fabricated |

**No public browser page errors or horizontal overflow does not equal UX acceptance.**
The deployed application lacks a first-party self-registration flow. Do not record
private staff browser proof on the basis of the public tour or source-string tests.

## Product-design diagnosis (what to fix, not mere color changes)

1. **Poor action hierarchy.** Homepage emphasizes product explanation instead of
   an actionable start path; signup missing completely. The tour emphasizes
   engineering disclosure instead of task progression.
2. **Insufficient screen grammar.** Large repeated rounded pale panels communicate
   visual uniformity, not urgency, state, or ownership.
3. **Density extremes.** Hero is overlarge while operational/table/status text
   has been overly small in source. No intentional density scale by task.
4. **Generic identity.** "SD" letter-square, system fallback type, muted slabs and
   undifferentiated cards do not add confidence or ownable brand recognition.
5. **No verified visual acceptance.** Existing `v2-professional-*-ui.test.ts`
   source-string checks cannot establish effective type scale, spacing, contrast,
   touch targets, or cross-screen coherence.
6. **Architecture drag.** `OperationalProductRoute.tsx` is about 3,929 lines and
   one CSS module about 86KB. Refactor by domain; don't continue monolithic UI patching.

## Professional product references: specifically what to borrow

These are design/interaction benchmarks, not assets to copy.

- **Jobber — service-business home/scheduling.**
  https://www.getjobber.com/features/dashboard/ and
  https://help.getjobber.com/en/articles/schedule-overview-new-schedule/
  Borrow the *business-operator mental model*: appointments, overdue follow-up,
  unresolved work, crew calendar, and direct next actions ahead of vanity KPIs.
- **Intercom — Inbox organization.**
  https://www.intercom.com/help/en/articles/6258745-the-inbox-explained
  Borrow state-based triage, persistent thread context, independent list/details
  panels, and predictable assignment controls. Use responsive panel focus.
- **Linear — visual discipline.**
  https://linear.app/changelog/2026-03-12-ui-refresh and
  https://linear.app/now/how-we-redesigned-the-linear-ui
  Borrow strong content hierarchy, consistent headers, quieter rails, controlled
  density, readable status semantics and keyboard navigation. Avoid copying
  a PM tool's information architecture for a field-service product.

## Decision: ServiceDesk V3 experience

**Positioning:** An operations command desk for residential cleaning business
owners and dispatchers. No fake AI assistant as a decorative avatar.

**Visual foundations**
- Left rail: deep dark green/charcoal as quiet chrome, not the main content's focus.
- Main: warm neutral light surfaces, useful emerald accents for primary action,
  neutral separators instead of shadows around every block.
- Typography: body 15–16px in operational screens, 13px metadata minimum where
  contrast permits; large editorial headings only on marketing and auth.
- State: attention/blocked/delivery states use words + tone, not color alone.
- Action placement: consistent page header, context toolbar, body, side detail.
- Mobile: one actionable panel at a time, 44px interactive targets, no sideways scroll.
- Never place raw provider IDs, unverified receipts, or code-like labels in public UI.

## Four incremental implementation slices

### Slice A — Make first-run real (this branch)
- Public entry from homepage and sign-in to `/auth/sign-up`.
- Supabase SSR email/password signup and *email verification required*.
- PKCE / token-hash callback, no open redirect.
- Post-auth role/workspace routing without user_metadata authorization.
- Single atomic verified OWNER workspace + MAIN branch + audit, via a tightly
  scoped authenticated SQL RPC; no service_role key in client.
- Config fail-closed. Route and migration tests.
- New deliberate registration visual identity.

**Not release complete** until Supabase email template, Redirect URL, email
delivery and exact-SHA disposable/staging SQL rehearsal pass. No live DB apply
or credential/config change without separate authorization.

### Slice B — Staff reality check
- Register with controlled consenting test email, verify, create workspace,
  seed only explicit synthetic records; capture desktop/tablet/mobile screenshots.
- Run keyboard, focus, branch selection, role denial, empty vs dense, failures.
- Record defects and fix before marketing claims.

### Slice C — Operational workspace redesign
- Overview: today's schedule / needs attention / customers waiting / collections.
- Inbox: triage, threaded conversation, customer context, assignment and delivery.
- Schedule: crew lanes, booked durations, conflict provenance, approved actions.
- Jobs: mobile crew flow / checklist / evidence / transition errors.
- Quotations/Invoices: task-first table/detail with audit/collection truth.
- Settings: separate business config, provider readiness, members, billing.

### Slice D — Public product presentation and polish
- Replace giant fixture hero with credible story and real browser captures from
  accepted operational flows. Rebuild tour for buyer-level value first; keep
  technical release evidence in operator-only details.
- Screenshot-based regressions, axe-style accessibility review, measured LCP/
  device responsiveness, consent/privacy review and final art-direction gate.

## Acceptance standards
- Actual 1440/834/390 Chromium screenshots, not CSS selectors alone.
- Visual comparison of happy path, no-data, loading, error and long-name/data.
- No newly exposed raw PII, secrets, provider tokens or fake status.
- Normal signup cannot grant OWNER rights inside another workspace; duplicate
  callbacks and concurrent registration do not create duplicate workspaces.
- Auth/DB setup blockers stay honest; no public production-ready claim.
