# Portfolio Cinematic + Guided Demo Dashboard — 2026-11-18

> **Owner instruction:** “go on and add them. also show the demo dashboard with proper guidance”. Existing Render service and portfolio branch are authoritative; work is a revision, not a new project.

**Goal:** Make the user-facing portfolio compelling *and* demonstrate an actually interactive business workspace for hiring clients.

**Design choice:** Preserve approved mint/porcelain design and site sections; add one cinematic hero event sequence with real locally licensed Lucide SVGs, an instructive manual-versus-automated comparison, and a separate guided dashboard at `/demo`. Reuse the existing public `sandbox-engine` reducer and quote calculator. No external/provider calls, no new animation libraries, no heavy video. CSS/SVG visual paths use motion based on operational state. Native links and scroll are never hijacked.

## Milestone A — Accurate dashboard model + tests
- [ ] Write first tests for `demo-dashboard-model.ts`: stage-to-view mapping, safe next action lookup, route labels and guide copy, status/ledger derivation.
- [ ] Verify failure before production code when a supported runner is available; otherwise record RED unavailable.
- [ ] Implement model with pure deterministic data from `sandboxStages`; no duplicate pricing or mock paid status.
- [ ] Add `src/app/demo/page.tsx`, isolated portfolio-mode gate and safe `/demo` GET/HEAD route allowlist.
- [ ] Add client `DemoOperationsDashboard.tsx` using exact `sandboxReducer`; state visible as dashboard panels.

## Milestone B — Guided UI and AI authorization
- [ ] Dashboard navigation: Overview, Inbox, Requests, Calendar, Crew, Finance, AI, Automations, Activity.
- [ ] First-run guide with explicit example-only disclosure, step-by-step contextual navigation, Skip/Restart and visible next action.
- [ ] Safe AI review: fixed example draft, Accept/Reject local-only; never call a model/send outbound messages.
- [ ] Payment status only from reducer; fake/provider states distinctly labeled.
- [ ] Mobile responsive UI with no hidden critical actions.

## Milestone C — Cinematic marketing site
- [ ] Replace decorative hero illustration with timed event handoff sequence, meaningful animated vector icon/line motion; Play/Pause/Replay and reduced-motion.
- [ ] Add manual versus automated process comparison with toggled service scenarios, no fake performance claims.
- [ ] Add prominent “Launch guided dashboard” CTA on homepage, nav, case study and sandbox back-navigation.
- [ ] Optional CSS View Transition for non-essential hover/section accents only. Never scroll hijack.

## Release critic gate
- [ ] Validate original SaaS home preserved, no added provider secrets/network, protected server paths untouched except narrowly scoped portfolio route allowlist.
- [ ] Count CSS module classes and original icon paths; verify no new external art.
- [ ] Run Render build `pnpm typecheck && pnpm build`; check exact source SHA and `live` at existing `srv-dbugfa5g1s2s73bpjne0`.
- [ ] Run dashboard Vitest and browser keyboard, mobile, reduced-motion, tutorial path when runner available; explicitly mark browser QA pending if not available.
