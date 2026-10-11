# ServiceDesk / Studio OS — authenticated product redesign

## Objective
Make a genuine operational SaaS feel fast, trustworthy, and saleable without replacing server-owned permissions, provider integration or real tenant data.

## Benchmark review (2026-10-11)
- **Jobber — dashboard and new schedule**: recommended actions, workload/quotes/invoices, daily appointments, team-assignment visibility and flexible time navigation. https://help.getjobber.com/en/articles/dashboard/ ; https://help.getjobber.com/en/articles/schedule-overview-new-schedule/
- **Intercom Inbox**: separate conversation queue, thread, and contact context; keyboard navigation and scoped teammate actions. https://www.intercom.com/help/en/articles/6258745-the-inbox-explained
- **Linear — redesigned workbench**: dense but ordered navigation, restrained chrome, actionable task views. https://linear.app/now/how-we-redesigned-the-linear-ui

These references are workflow benchmarks, not designs to copy.

## Approved implementation scope
Frontend-owned presentation files only: staff shell, page hierarchy, operational dashboard, inbox, dispatch, CRM queues, quotes, jobs, invoice collection, empty/loading/error states, public marketing color identity and registration styling. Never modify customer portal styling, authentication behavior, backend contracts, migrations, payment flows or provider credentials.

## Visual language
- **Graphite sidebar** (#142B33), not beige editorial or indigo Signal Desk.
- **Crisp operating canvas** (#F3F6F7) and white surfaces, with compact strokes (#DCE5E8).
- **Teal interaction accent** (#0B746D) exclusively for actions and active navigation. Do not use color without a meaningful state.
- **Readability:** Inter/system sans, 14px foundational UI text, 17–19px section headers, 30–40px screen headings; numerical KPIs tabular.
- **Structured density:** obvious selected items, 44px mobile controls, meaningful list rows, status badges and restrained 8–12px corner radius.
- **Contrast:** dark/nav and white/content areas; visible keyboard focus; avoid low-contrast pastel type, disable animation under prefers-reduced-motion.
- **Truth:** all counts, statuses and timestamps derive from authorized snapshot. Avoid fake AI confidence/revenue/online state.
- **Responsive:** 320, 390, 834, 1280 and 1440px tested against real authorized states when an isolated preview is available.

## Accessibility target\nFollow WCAG 2.2 principles for focus visibility and usable targets; measure text contrast against actual colors, not visual intuition. Reference: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance and https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum . The automated palette assertions cover selected colors only; browser accessibility acceptance remains mandatory.\n\n## Acceptance
1. Operator can understand needs-attention, today's schedule, outstanding payments and intake work within 10 seconds.
2. Inbox preserves triage/search + conversation context and navigates to real linked records.
3. Dispatch surfaces unassigned visits, crew context and actual slot state without implying a capacity hold equals a confirmed job.
4. Search and queue filters preserve selected record and show honest zero states.
5. Keyboard tab/focus, reduced motion, mobile and dense layouts verified.
6. Focused tests, typecheck, lint, then actual authenticated browser screenshots and full build before release.
7. Workroom visual direction requires owner review; tests do not constitute visual acceptance.
