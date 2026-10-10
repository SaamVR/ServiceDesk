# V2 Closure W3 — Authenticated Staff UI / Browser / Accessibility

## Mandatory source and proof contract

Repository: `SaamVR/ServiceDesk`. Observed canonical and gate starting SHA: `ca2db4ea958c038c5b3c0a3b7d2add5350095bff`.
Read `AGENTS.md` and `docs/execution/coordinator-four-chat-20261004.md`. Before edits, refresh remote HEAD; run `git rev-parse HEAD` and `git status --short` in an isolated GPT Runtime checkout. Newer legitimate work takes precedence over this packet. Never reset/rebase/force-push existing work.

Use GPT Runtime for actual implementation and tests. GitHub connector writes are permitted if Runtime Git transport fails, but **do not claim executable tests PASS from static review**. No device fallback, staging/production database mutation, provider secret changes or live payments. Keep separate exact evidence levels: IMPLEMENTED, CONTRACT_TESTED, PROVIDER_VERIFIED, OPERATIONS_VERIFIED, CONFIGURATION_BLOCKED.

Each READY slice is a substantive task. Target 20–30 minutes of actual active work; no waiting or manufactured duration. Deliver isolated branch commits and a lane receipt listing start/end SHAs, changed files, exact commands/results, concrete risk and blocker. Do not claim another chat/agent is working unless activated.

**Proposed worker branch:** `feat/servicedesk-v2-closure-w3-staff-browser-20261010`. **Integration destination:** canonical V2. **Exclusive paths:** `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`, `tests/e2e/**` **except** `src/features/operations/release-readiness-runtime.ts`, `tests/e2e/v2-release-readiness-runtime.test.ts`, `tests/e2e/v2-release-health-readiness.test.ts` while Control Tower fix is in review.

- **CLOSE-301 W3-T1 READY:** Verify sign-in, session, onboarding, workspace switch and branch-scoped permission denial with genuine staff session and synthetic/non-sensitive data. Never call an unauthenticated public-page smoke receipt "staff acceptance."
- **CLOSE-302 W3-T2 READY:** Exercise enquiry → request → quote → acceptance → booking on actual server-backed routes; distinguish fixture-only action from authoritative persisted action, and fix source-confirmed broken UI states.
- **CLOSE-303 W3-T3 READY:** Exercise inbox unresolved identity, reply/handover, dispatch/crew completion/quality and sandbox payment/invoice in protected staff routes. Check denied access / outbox retries / pending/error/loading states.
- **CLOSE-304 W3-T4 READY:** Real Chrome screenshots and console checks at desktop 1440×900, tablet 834×1112, mobile 390×844 for authenticated staff views; check keyboard/focus, form labels, overflow, route permission and accessible errors. Record each route/role/viewport/result.
- **CLOSE-305 W3-T5 READY:** Review workflow-builder, photo human-review, retention suppression and Settings accessibility; fix at least one reproducible UX defect and add `tests/e2e/**` regression when source warrants.

**Focused checks:** `pnpm exec vitest run tests/e2e/v2-auth-product.test.ts tests/e2e/v2-multibranch-runtime-scope.test.ts tests/e2e/v2-operational-product-routing.test.ts tests/e2e/accessibility-contract.test.ts`; `pnpm typecheck`; browser matrix from exact deployed build.

**Acceptance:** authenticated **real** browser receipt with build SHA, separate from 9/9 public smoke; no fake credentials, sessions or access. If credentials/browser unavailable, leave `AUTHENTICATED_STAFF_BROWSER` CONFIGURATION_BLOCKED; implement source-level fixes and report missing prerequisite. **Fallbacks:** keyboard and responsive focus/overflow tests on publicly accessible UI; deep-link authorization-error recovery.
