# ServiceDesk Portfolio — Cinematic + Guided Dashboard Release Candidate

Date: 2026-11-18. Source: PR #918, branch `feat/servicedesk-automation-portfolio-case-study-20261118`. Destination: existing Render service `srv-dbugfa5g1s2s73bpjne0`, stable URL `https://servicedesk-automation-portfolio.onrender.com`.

## Product experience
- Homepage cinematic six-scene interactive journey (real vendored Lucide SVG masks, dedicated playback/replay and reduced-motion support), with primary CTA to `/demo`.
- Four-scenario Operations Theater retained, including proper human review gates, plus existing interactive lifecycle, AI previews, 27 source-defined internal rule starters, provider map, and recovery lab.
- Three-scenario manual vs connected workflow comparison; explicit statement that no time-saving metrics are measured.
- New `/demo` guided dashboard route, portfolio-only (404 if portfolio mode false), nine modules, responsive navigation and progress-aware onboarding guide.
- All nine modules use the existing public `sandbox-engine` for actual sandbox stage/financial/delivery/audit transitions; local AI approval and checklist selections are separated presentation-only state.
- Public GET/HEAD allowlist adds only `/demo`; no other direct SaaS/auth/API routes made available. Homepage retains original non-portfolio product path.
- Workflow sandbox `/sandbox` remains available separately for lower-level acceptance.

## Suggested owner walkthrough
1. Open `/demo` and follow the nine guided tour prompts; inspect the operator overview, inbox, requests, schedule, crew, finance, AI, automations and activity screens.
2. On Overview, press **Advance** sequentially. Quote, acceptance, hold, mock payment, crew, work, review and balance unlock in correct order; financial totals update.
3. On Inbox, after a sample deposit, queue a mock confirmation and inject failure, then retry; mock transport acceptance never appears as delivered.
4. On AI, edit and approve/reject a local draft; verify no customer message is sent.
5. On Automations, search/filter the 27 real source-defined internal attention starters; no rule can be published.
6. Restart the tour or reset the sandbox. Refresh should reset all local state (no persistence).

## Critic and QA gates
- Review exact source diff, CSS classes, SVG files and license.
- Verify TypeScript and Next production build at pinned SHA on same Render service. Avoid creating another instance.
- The following cannot be marked PASS without observed execution: Vitest runtime, real-browser keyboard/mobile/touch, visual animation frame-by-frame audit, contrast and reduced-motion, independent HTTP.
- Provider P02/P03/P12 remain separate and are not fulfilled by the public demonstration.
