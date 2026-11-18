# Interactive Operations Theater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:test-driven-development, verification-before-completion and independently review the exact diff before release.

**Goal:** Convert the ServiceDesk portfolio from disconnected animated modules into a causal six-stage user-controlled business-event theater.

**Architecture:** A pure typed reducer models four synthetic scenarios and human-approval exceptions; an isolated React/CSS module animates only presentation, with one mount in the existing portfolio homepage. No auth/provider/backend code changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, CSS modules, vendored original Lucide SVG, Vitest.

**Spec:** docs/superpowers/specs/2026-11-18-operations-theater-design.md

## Global Constraints
- Preserve the SaaS homepage and separate P02→P12 production gates.
- Keep all state client-local and all messages synthetic; no outbound fetch or saved customer data.
- Use approved existing Render service/branch, manual deployment only, never create another service.
- Respect reduced motion and viewport visibility; expose controls to keyboard and assistive technology.

## Review Focus
1. Guarded scenario stops at correct stage, never advances without local acknowledgment.
2. Completed scenario cannot loop into fictional repeat business or claim real provider receipts.
3. Scenario change resets old approvals and progression.
4. Pause/reduced-motion/background state prevents timers from advancing.
5. 320px responsive layout and correct native button/focus ordering; motion cannot hide required content.

### Task 1 — Pure scenario controller
- [ ] Write meaningful state-transition tests in `tests/e2e/v4-portfolio-operations-theater.test.ts`.
- [ ] Verify test RED with missing model (if an approved test runner is available); otherwise mark RED unverified.
- [ ] Implement `src/features/product/operations-theater-model.ts` with `getScenario`, `initialTheaterState`, `theaterTransition`, `theaterIsBlocked` and `theaterLedger`.
- [ ] Run focused tests and preserve result. No implementation claim from test text alone.

### Task 2 — Responsive interactive motion component
- [ ] Implement `OperationsTheater.tsx` with 4 presets, 6 icon stages, customer/operator view, channel, fictional request field, safe-stop review and controls.
- [ ] Add `OperationsTheater.module.css` with transform/opacity-driven event transitions, staggered readouts, accessible mobile layout and reduced-motion fallback.
- [ ] Source review for effect cleanup, timer visibility, static content readability and all aria controls.

### Task 3 — Cohesive site wiring
- [ ] Mount the theater immediately below the hero and link directly from the hero CTA.
- [ ] Add source/QA receipt; ensure existing AI studio, 27 starters, all integration/exception pages and portfolio route allowlist remain unchanged.

### Task 4 — Release critic and same-service deployment
- [ ] Inspect exact Git diff, icon and CSS class references, source guards and sample honesty.
- [ ] Run Render `pnpm typecheck && pnpm build` on exact SHA; green required for deployment completion, not a substitute for browser testing.
- [ ] Confirm Render `live`, URL and SHA; separately label browser visual QA unverified if no controlled real browser is available.
- [ ] Record receipt in existing PR #918; no extra Render service.
