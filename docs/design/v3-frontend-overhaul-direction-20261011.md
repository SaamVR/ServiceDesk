# ServiceDesk AI V3 — Frontend Redesign Direction & Execution Contract

**Status:** UX/visual direction NOT YET ACCEPTED. This is a creative and
operational brief, not evidence that the UI was built or visually approved.
**Working branch:** `feat/servicedesk-v3-ui-overhaul-20261011`
(based on verified V3 SHA `b2b153d57213bb2f5f4aea1473a205b359b53a9b`).
The primary UX designer/front-end agent has exclusive ownership of presentation
files, while core/domain and provider/AI implementation lanes work separately.

## Reset the design approach

Current UI is explicitly rejected by the owner. Do not apply small token
recolors to the existing green-themed shells and call that a redesign.

Create three **real working visual concepts** or coded responsive prototypes,
choose one by critical evaluation, and implement it across real operational
surfaces. Concepts can evolve, but should explore genuinely distinct visual
systems:

1. **Precision Ledger** — near-white warm neutral surfaces, deep ink
   typography, ultraclear data hierarchy, sharp but nuanced geometry,
   restrained blue/teal operational highlights, crisp tabular numerals.
   Inspired by best-in-class productivity SaaS, not copied.
2. **Signal Desk** — graphite/indigo navigation, light task canvas,
   purposeful vibrant action status colors, high contrast split-view
   inbox, tactical but humane scheduling and precise focus states.
3. **Calm Operations Studio** — warmer off-white editorial layout, confident
   dense work areas, muted indigo/brick brand tones, premium typography and
   expressive but subdued interaction choreography.

Compare clarity, brand uniqueness, data density, color/accessibility,
responsiveness, implementation complexity, and B2B sales credibility.
**Do not default to green** merely because it is present in the old UI.
The chosen system needs a reusable token and component architecture.

## Daily owner journey (must feel like real software)

1. An owner logs in and sees a high-signal **Today** overview: unhandled
   inbound leads, quotes requiring decision, upcoming jobs, at-risk visits,
   crew availability/coverage and overdue invoices. Every count must originate
   in the existing authorized runtime or show a grounded empty/blocked state.
2. A new enquiry opens in an **Inbox** master/detail split. One action drawer
   surfaces the customer context, outstanding questions, next actions and
   message history. No fixture-only CTA.
3. The owner follows a quote into **Jobs & Dispatch**, compares crews, visits,
   timings and exceptions; sees job status/ownership without hunting through
   nested navigation. Visual states reflect domain truth.
4. Customer detail unifies properties, communication, active work and
   invoices through readable structured records.
5. Settings and health disclose degraded integrations, onboarding needs,
   payment sandbox states and audit/recovery facts clearly.

## Layout and component acceptance

- Global shell: coherent workspace selector, command/search entry, sidebar
  with real route hierarchy, clear account/auth status and mobile nav.
- Real density: make the primary operator task the largest component,
  preserve contextual secondary actions, avoid overinflated KPI cards and
  arbitrary hero illustrations inside logged-in pages.
- Tables: dense but legible, sticky headings when appropriate, aligned
  amounts, well-calibrated sorting, filters, tabs and empty states.
- Priority/status: never rely on color alone; text label, icon or shape.
- Drawer/dialog: accessible focus trap/return, ESC behavior, keyboard-first,
  screenreader labels and robust mobile alternatives.
- Responsive: **320, 390, 834, 1280 and 1440px**; no horizontal overflow,
  tap targets readable, no inaccessible table columns at narrow widths.
- Motion: purposeful 140–240ms transitions where useful; orchestration
  should explain state, not distract. Respect prefers-reduced-motion.
- Performance: no heavy WebGL/3D assets on operational dashboards.
  Prefer CSS/composited transform/opacity and measured browser runtime.
- Loading/errors: human task-specific messages and retry pathways without
  fake success, mock analytics, invented data, or secret leakage.
- Visual acceptance: save real Chromium screenshots and compare before/after
  for Today, Inbox, Dispatch, Customers, Auth at target widths.

## Existing security and integration constraints

Do not weaken Supabase SSR cookies, staff membership/role boundaries,
customer/crew tenancy or password recovery to improve a visual demo.
The connected staging database is at migration head **0036** and signup
feature flag remains false; display honest disabled states. Supabase Auth
SMTP is owner-reported configured but no delivered test receipt has yet
been confirmed. Core lane introduced an unverified, pure role-aware workspace
destination resolver in PR #78; W4 should adopt the typed contract only after
coordinator integration and test acceptance.

## Frontend delivery sequence

**Wave A:** working design tokens and global operational shell / navigation.
**Wave B:** Today + Inbox, task-first interaction, real runtime data.
**Wave C:** Jobs + Dispatch scheduling, operations detail hierarchy.
**Wave D:** Customers, Quotes, Billing, Integrations.
**Wave E:** Auth, owner onboarding, marketing front door, coherent brand.
**Wave F:** browser acceptance, accessibility, movement/performance QA.

Each wave must produce changed code and browser proof with exact commit,
not only design advice. W4 may parallelize disjoint components when independent
subagents/runtime support this, but must not claim autonomous agents or work
that has not actually run.

## Coordination

Coordinator integration branch is
`feat/servicedesk-v3-coordination-20261011`. Open draft PR against this
branch after first meaningful UI wave. Do not change the shared Render
gate without controller approval, and never touch the canonical V2 branch.
Only the coordinator owns shared configs/contracts and resolved integration.
