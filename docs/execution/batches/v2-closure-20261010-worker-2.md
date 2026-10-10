# V2 Closure W2 — Integrations / AI / Controlled Provider Truth

## Mandatory source and proof contract

Repository: `SaamVR/ServiceDesk`. Observed canonical and gate starting SHA: `ca2db4ea958c038c5b3c0a3b7d2add5350095bff`.
Read `AGENTS.md` and `docs/execution/coordinator-four-chat-20261004.md`. Before edits, refresh remote HEAD; run `git rev-parse HEAD` and `git status --short` in an isolated GPT Runtime checkout. Newer legitimate work takes precedence over this packet. Never reset/rebase/force-push existing work.

Use GPT Runtime for actual implementation and tests. GitHub connector writes are permitted if Runtime Git transport fails, but **do not claim executable tests PASS from static review**. No device fallback, staging/production database mutation, provider secret changes or live payments. Keep separate exact evidence levels: IMPLEMENTED, CONTRACT_TESTED, PROVIDER_VERIFIED, OPERATIONS_VERIFIED, CONFIGURATION_BLOCKED.

Each READY slice is a substantive task. Target 20–30 minutes of actual active work; no waiting or manufactured duration. Deliver isolated branch commits and a lane receipt listing start/end SHAs, changed files, exact commands/results, concrete risk and blocker. Do not claim another chat/agent is working unless activated.

**Proposed worker branch:** `feat/servicedesk-v2-closure-w2-provider-20261010`. **Integration destination:** canonical V2. **Exclusive paths:** `src/server/integrations/**`, `src/server/ai/**`, provider-handler internals, `tests/providers/**` except `tests/providers/v2-release-readiness-registry.test.ts` while Control Tower release fix is in review, `tests/ai/**`, `examples/n8n/**`. Shared contracts and release registry are Control Tower owned.

- **CLOSE-201 W2-T1 READY:** Inventory actual WhatsApp, Google Calendar, Email, n8n, AI, Email inbound and Voice inbound implementations against `src/server/integrations/readiness/provider-readiness.ts` and `inbound-proof.ts`. Classify each IMPLEMENTED / CONTRACT_TESTED / PROVIDER_VERIFIED / CONFIGURATION_BLOCKED; cite actual config and receipt validation only, never presence as proof.
- **CLOSE-202 W2-T2 READY:** Exercise idempotent WhatsApp webhook persist → process → ACK/retry and terminal delivery state with duplicate, reordered, invalid-signature and malformed payload tests, in `src/server/integrations/whatsapp/**` and `tests/providers/**`. Fix only reproduced failures.
- **CLOSE-203 W2-T3 READY:** Exercise Google Calendar token expiry / sync-token rebuild / external conflict recovery using existing `src/server/integrations/google-calendar/**`, under provider-free contract tests. Ensure no phantom confirmed booking.
- **CLOSE-204 W2-T4 READY:** Validate Email/Voice inbound signature and contact-identity mapping; ensure invalid/ambiguous identity fails closed without leaking customer information.
- **CLOSE-205 W2-T5 READY:** Audit n8n callback replay signature/authority and AI output cannot create authoritative business mutations. Patch reproducible problems with focused tests.

**Focused checks:** use existing `tests/providers/**` and `tests/ai/**`, `pnpm exec vitest run tests/providers tests/ai`, `pnpm typecheck`. Scope expensive checks to changed paths, let Control Tower run one combined RC.

**Acceptance:** repeatable provider-free negative tests; controlled real-provider receipts only if eligibility and safe credentials actually exist. **Fallbacks:** make read-only provider readiness diagnostics actionable; harden redaction/idempotency of failed callback paths. Payment stays SANDBOX/DEMO ONLY.
