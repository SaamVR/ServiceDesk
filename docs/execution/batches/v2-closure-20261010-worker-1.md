# V2 Closure W1 — Core / PostgreSQL / Branch Security

## Mandatory source and proof contract

Repository: `SaamVR/ServiceDesk`. Observed canonical and gate starting SHA: `ca2db4ea958c038c5b3c0a3b7d2add5350095bff`.
Read `AGENTS.md` and `docs/execution/coordinator-four-chat-20261004.md`. Before edits, refresh remote HEAD; run `git rev-parse HEAD` and `git status --short` in an isolated GPT Runtime checkout. Newer legitimate work takes precedence over this packet. Never reset/rebase/force-push existing work.

Use GPT Runtime for actual implementation and tests. GitHub connector writes are permitted if Runtime Git transport fails, but **do not claim executable tests PASS from static review**. No device fallback, staging/production database mutation, provider secret changes or live payments. Keep separate exact evidence levels: IMPLEMENTED, CONTRACT_TESTED, PROVIDER_VERIFIED, OPERATIONS_VERIFIED, CONFIGURATION_BLOCKED.

Each READY slice is a substantive task. Target 20–30 minutes of actual active work; no waiting or manufactured duration. Deliver isolated branch commits and a lane receipt listing start/end SHAs, changed files, exact commands/results, concrete risk and blocker. Do not claim another chat/agent is working unless activated.

**Proposed worker branch:** `feat/servicedesk-v2-closure-w1-db-20261010`. **Integration destination:** `feat/servicedesk-v2-multilane-20261006`; merge only after focused and RC gates. **Exclusive paths:** `supabase/migrations/**`, `src/server/core/**`, `src/domain/**`, `src/server/jobs/**`, `tests/db/**`, `tests/domain/**`. No shared contracts or controller release registry edits.

- **CLOSE-101 W1-T1 READY:** Reconcile source `supabase/migrations/0053_v2_multibranch_core.sql`, `0054_v2_multibranch_resources.sql`, `0058_v2_enterprise_governance.sql` with existing tenant/branch tests. Produce a precise matrix: actor/workspace/branch, valid/expired membership, expected ALLOW/DENY. Record gaps, not hypothetical vulnerability claims.
- **CLOSE-102 W1-T2 READY after T1:** Implement the highest-severity source-confirmed cross-workspace/branch authorization or RLS regression **only if reproduced**; attach a failing-before/green-after `tests/db/**` assertion. Never rewrite a migration already applied in any real environment. If none, add a negative test for the clearest currently untested boundary without inventing evidence.
- **CLOSE-103 W1-T3 READY:** Re-run existing migration inventory/rehearsal through `0058` from a disposable PostgreSQL synthetic baseline, with exact-build fingerprint, SQL error log hash, schema probes, rollback/reset and cleanup. Existing `65/65` PASS applies **only** to `ca2db4ea958c038c5b3c0a3b7d2add5350095bff`; any new SHA needs new proof.
- **CLOSE-104 W1-T4 READY:** Verify recovery/idempotence under failed authorization/transaction using tests in `tests/domain/**` or `tests/db/**`. Fix actual defects without broad refactor.

**Focused checks:** `pnpm exec vitest run tests/db/v2-multibranch-core-migration.test.ts tests/db/v2-multibranch-resources-migration.test.ts tests/db/v2-enterprise-governance-migration.test.ts`; then `pnpm typecheck`. Run disposable migration only against synthetic isolated PG.

**Acceptance:** real negative authorization assertions, no regressions, immutable migration practice, no credential/PII exposure, exact receipt. **Fallback:** audit branch membership expiry and support-read export scope tests; if already covered, stop and report verified coverage rather than manufacturing a defect.
