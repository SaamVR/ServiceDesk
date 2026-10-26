# ServiceDesk F11 SONIC — scoped revenue, field quality and reliability review proposals

Issue [#856](https://github.com/SaamVR/ServiceDesk/issues/856) · Master [#808](https://github.com/SaamVR/ServiceDesk/issues/808) · Original 72-workflow [#173](https://github.com/SaamVR/ServiceDesk/issues/173). Feature-only authority, Production owns integration/fixes/release.

Original lane source base `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff`; coordinator integration parent `d5e86b369c46384278be8006812a3e27c41da21e` after P02 Vercel guard merge, distinct from F08 draft #841, F09 draft #852 and F10 draft #854. No other repo/source path overwritten. Three source lanes and independent tests, one separate crosslane critic test lane, one governance lane. Draft integrated PR for review only.

## Six new source policies

| Domain | Proposed owner task only | Explicit missing operational dependency |
|---|---|---|
| Quote expiry review | REVIEW_EXPIRED_QUOTE on SENT unaccepted expired quote | Saved authenticated quote/version; quote status truth; approval; worker task |
| Invoice overdue review | REVIEW_OVERDUE_INVOICE on ISSUED unpaid due invoice with bounded outstanding minor units | Saved invoice/ledger source, settlement reconciliation, owner approval, no charge |
| Checklist gap review | REVIEW_INCOMPLETE_CHECKLIST on overdue IN_PROGRESS visit with uncompleted required checks | Saved signed crew checklist and visit schedule, consent and photo controls |
| Incident escalation review | REVIEW_FIELD_INCIDENT for still-open HIGH/CRITICAL severity from saved projection | Incident integrity/permission, trusted severity, QA decision and human triage |
| Provider health review | REVIEW_PROVIDER_DEGRADATION after 3 saved failed checks and 5 minutes | Authorized provider heartbeat, signed/observed transport, dead-letter policy |
| Outbox dead-letter review | REVIEW_OUTBOX_DEAD_LETTER on UNDELIVERED dead-letter, 3–30 retries | Transactional outbox, true provider receipts, idempotent replay and separate outbound approval |

Each policy is a pure bounded deterministic review planner, NOT a webhook/scheduler/persisted task/AI model call. Inputs are treated as **caller-claimed** saved records; strict exact plain source shape, OWNER workspace and branch, version equality, RFC timestamps through trusted quote clock, bounded business states, no leaked contact PII, and fingerprint of approved candidate source fields. The fingerprint is NOT a committed idempotency key. Invalid or stale data fail closed. NOT_DUE creates no fingerprint.

Every successful result hardcodes `saved=false`, `scheduled=false`, `executed=false`, `providerCalled=false`, `customerMessageSent=false`, `financialMutation=false`, `bookingChanged=false` and `recordChanged=false`. No live #173 checklist can be checked off merely because this source batch passes G0.

## Lanes and authority

- Revenue `sonic-feature/f11-revenue-20261026`: `src/server/ai/sonic-f11-revenue.ts` and `tests/ai/sonic-f11-revenue.test.ts`
- Field `sonic-feature/f11-quality-20261026`: `sonic-f11-quality.ts` and associated tests.
- Resilience `sonic-feature/f11-ops-resilience-20261026`: `sonic-f11-resilience.ts` and associated tests.
- Critic `sonic-feature/f11-crosslane-critic-20261026`: `tests/ai/sonic-f11-crosslane-critic.test.ts`, no feature source writes.
- Governance `sonic-feature/f11-governance-20261026`: this runbook.
- Coordinator integrates exactly eight additive paths from Git blob identities over same canonical, not silent merges of other draft PRs.

## Production acceptance gate

Before integrating to a real workspace Production must re-read true owner role, workspace/branch membership, saved source ID/version in a transaction, use immutable source-event journal, upsert unique internal attention tasks with compare-and-swap and lease/dead-letter behavior, instrument auditing, run authenticated OWNER A/B negative tests, confirm quote/invoice actual states, require permission/consent before any provider send, and separately approve any migrations/hosting/release. PR CI verifies only G0 source quality. No Supabase operation, external model/provider, N8N job, customer send, payment, auto assignment, deletion, deployment or canonical/main merge is authorized by F11.

If source tests fail, repair only owning F11 lane before re-running exact-head CI. No blanket F08–F11 merge. Production exclusively chooses integration order and independently evaluates overlapping business contracts.
